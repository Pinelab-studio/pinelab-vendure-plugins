import { CloudTasksClient } from '@google-cloud/tasks';
import {
  ID,
  Injector,
  InspectableJobQueueStrategy,
  Job,
  JobData,
  JobQueueStrategy,
  ListQueryBuilder,
  Logger,
  PaginatedList,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { CloudTasksPlugin } from './cloud-tasks.plugin';
import { CloudTaskMessage, CloudTaskOptions } from './types';
import { In, LessThan } from 'typeorm';
import { JobListOptions, JobState } from '@vendure/common/lib/generated-types';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';

const LIVE_QUEUES = new Set<string>();

export type QueueProcessFunction = (job: Job) => Promise<any>;
export const PROCESS_MAP = new Map<string, QueueProcessFunction>();

export class CloudTasksJobQueueStrategy implements InspectableJobQueueStrategy {
  private client: CloudTasksClient;
  private connection: TransactionalConnection | undefined;
  private listQueryBuilder: ListQueryBuilder | undefined;

  init(injector: Injector): void | Promise<void> {
    this.connection = injector.get(TransactionalConnection);
    this.listQueryBuilder = injector.get(ListQueryBuilder);
  }

  constructor(private options: CloudTaskOptions) {
    this.client = new CloudTasksClient();
  }

  async findOne(id: ID): Promise<Job<any> | undefined> {
    if (!this.connection) {
      throw new UserInputError('TransactionalConnection is not available');
    }
    const jobRecord = await this.connection
      .getRepository(JobRecord)
      .findOne({ where: { id } });
    if (!jobRecord) {
      throw new UserInputError(`no JobRecord with id ${id} exists`);
    }
    return new Job(jobRecord);
  }

  async findMany(
    options?: JobListOptions | undefined
  ): Promise<PaginatedList<Job<any>>> {
    if (!this.listQueryBuilder) {
      throw new UserInputError('ListQueryBuilder is not available');
    }
    return this.listQueryBuilder
      .build(JobRecord, options)
      .getManyAndCount()
      .then(([items, totalItems]) => ({
        items: items.map(this.fromRecord),
        totalItems,
      }));
  }

  async findManyById(ids: ID[]): Promise<Job<any>[]> {
    if (!this.connection) {
      throw new UserInputError('TransactionalConnection is not available');
    }
    return this.connection
      .getRepository(JobRecord)
      .find({ where: { id: In(ids) } })
      .then((records) => records.map(this.fromRecord));
  }

  async removeSettledJobs(
    queueNames: string[],
    olderThan?: Date | undefined
  ): Promise<number> {
    if (!this.connection) {
      throw new UserInputError('TransactionalConnection is not available');
    }
    const findOptions = {
      ...(0 < queueNames.length ? { queueName: In(queueNames) } : {}),
      isSettled: true,
      settledAt: LessThan(olderThan || new Date()),
    };
    const deleteCount = await this.connection
      .getRepository(JobRecord)
      .count({ where: findOptions });
    await this.connection.getRepository(JobRecord).delete(findOptions);
    return deleteCount;
  }

  async cancelJob(jobId: ID): Promise<Job<any> | undefined> {
    if (!this.connection) {
      throw new UserInputError('TransactionalConnection is not available');
    }
    const jobRecord = await this.connection
      .getRepository(JobRecord)
      .findOne({ where: { jobId } });
    if (!jobRecord) {
      throw new UserInputError(`no JobRecord with id ${jobId} exists`);
    }
    const job = new Job(jobRecord);
    job.cancel();
    return new Job(
      await this.connection.getRepository(JobRecord).save(new JobRecord(job))
    );
  }

  destroy() {
    this.connection = undefined;
    this.listQueryBuilder = undefined;
  }

  private fromRecord(this: void, jobRecord: JobRecord): Job<any> {
    return new Job<any>(jobRecord);
  }

  async add<Data extends JobData<Data> = {}>(
    job: Job<Data>
  ): Promise<Job<Data>> {
    const queueName = this.getQueueName(job.queueName);
    if (!LIVE_QUEUES.has(queueName)) {
      await this.createQueue(queueName);
    }
    const cloudTaskMessage: CloudTaskMessage = {
      id: `${queueName}-${Date.now()}`,
      queueName: queueName,
      data: job.data,
      createdAt: new Date(),
      maxRetries: job.retries || this.options.defaultJobRetries || 3,
    };
    if (!this.connection) {
      throw new UserInputError('TransactionalConnection is not available');
    }
    const jobRecordRepo = this.connection.getRepository(JobRecord);
    const parent = this.getQueuePath(queueName);
    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        headers: {
          'Content-type': 'application/json',
          Authorization: `Bearer ${this.options.authSecret}`,
        },
        url: `${this.options.taskHandlerHost}/cloud-tasks/handler`,
        body: Buffer.from(JSON.stringify(cloudTaskMessage)).toString('base64'),
      },
    };
    const request = { parent, task };
    let currentAttempt = 0;
    while (true) {
      try {
        await this.client.createTask(request, {
          maxRetries: cloudTaskMessage.maxRetries,
        });
        Logger.debug(
          `Added job with retries=${cloudTaskMessage.maxRetries} to queue ${queueName}: ${cloudTaskMessage.id} for ${task.httpRequest.url}`,
          CloudTasksPlugin.loggerCtx
        );
        const successfullJob = new Job({
          id: cloudTaskMessage.id,
          queueName: job.queueName,
          data: job.data,
          attempts: job.attempts,
          state: JobState.RUNNING,
          startedAt: job.startedAt,
          createdAt: job.createdAt,
          retries: job.retries,
          progress: 100,
        });
        await jobRecordRepo.save(
          new JobRecord({
            queueName: job.queueName,
            data: job.data,
            attempts: job.attempts,
            state: JobState.RUNNING,
            startedAt: job.startedAt,
            createdAt: job.createdAt,
            retries: job.retries,
            isSettled: true,
            settledAt: new Date(),
            progress: 100,
          })
        );
        return successfullJob;
      } catch (e: any) {
        currentAttempt += 1;
        Logger.error(
          `Failed to add task to queue ${queueName}: ${e?.message}`,
          CloudTasksPlugin.loggerCtx,
          e
        );
        if (currentAttempt === (this.options.createTaskRetries ?? 5)) {
          await jobRecordRepo.save(
            new JobRecord({
              queueName: job.queueName,
              data: job.data,
              attempts: job.attempts,
              state: JobState.FAILED,
              startedAt: job.startedAt,
              createdAt: job.createdAt,
              progress: 0,
              retries: this.options.createTaskRetries ?? 5,
            })
          );
          throw e;
        }
      }
    }
  }

  /**
   * Starts the job queue.
   * We want to make this AS FAST AS POSSIBLE in order to reduce startup times.
   * Therefore we lazily create the queue in the `add` method.
   */
  async start<Data extends JobData<Data> = {}>(
    originalQueueName: string,
    process: (job: Job<Data>) => Promise<any>
  ) {
    const queueName = this.getQueueName(originalQueueName);
    PROCESS_MAP.set(queueName, process);
    Logger.info(`Started queue ${queueName}`, CloudTasksPlugin.loggerCtx);
  }

  /**
   * Stops the job queue
   */
  async stop<Data extends JobData<Data> = {}>(
    queueName: string,
    _process: (job: Job<Data>) => Promise<any>
  ) {
    PROCESS_MAP.delete(this.getQueueName(queueName));
    Logger.info(
      `Stopped queue ${this.getQueueName(queueName)}`,
      CloudTasksPlugin.loggerCtx
    );
  }

  private getQueueName(name: string): string {
    return this.options.queueSuffix
      ? `${name}-${this.options.queueSuffix}`
      : name;
  }

  private getQueuePath(queueName: string): string {
    return this.client.queuePath(
      this.options.projectId,
      this.options.location,
      queueName
    );
  }

  private async createQueue(queueName: string): Promise<void> {
    if (LIVE_QUEUES.has(queueName)) {
      return; // Already added
    }
    try {
      await this.client.createQueue({
        parent: this.client.locationPath(
          this.options.projectId,
          this.options.location
        ),
        queue: { name: this.getQueuePath(queueName) },
      });
      LIVE_QUEUES.add(queueName);
    } catch (error: any) {
      if (error?.message?.indexOf('ALREADY_EXISTS') > -1) {
        LIVE_QUEUES.add(queueName);
        Logger.debug(
          `Queue ${queueName} already exists`,
          CloudTasksPlugin.loggerCtx
        );
      } else {
        throw error;
      }
    }
  }
}
