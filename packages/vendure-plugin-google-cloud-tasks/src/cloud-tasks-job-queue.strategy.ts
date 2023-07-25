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
  User,
  UserInputError,
} from '@vendure/core';
import { CloudTasksPlugin } from './cloud-tasks.plugin';
import { CloudTaskMessage, CloudTaskOptions } from './types';
import { In, LessThan, Repository, DataSource } from 'typeorm';
import { JobListOptions, JobState } from '@vendure/common/lib/generated-types';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';

const LIVE_QUEUES = new Set<string>();

export type QueueProcessFunction = (job: Job) => Promise<any>;
export const PROCESS_MAP = new Map<string, QueueProcessFunction>();

export class CloudTasksJobQueueStrategy implements InspectableJobQueueStrategy {
  private client: CloudTasksClient;
  private listQueryBuilder: ListQueryBuilder | undefined;
  private jobRecordRepository!: Repository<JobRecord>;

  init(injector: Injector): void | Promise<void> {
    this.listQueryBuilder = injector.get(ListQueryBuilder);
    this.jobRecordRepository = injector
      .get(DataSource)
      .getRepository(JobRecord);
  }

  constructor(private options: CloudTaskOptions) {
    this.client = new CloudTasksClient();
  }

  async findOne(id: ID): Promise<Job<any> | undefined> {
    if (!this.jobRecordRepository) {
      throw new UserInputError('TransactionalConnection is not available');
    }
    const jobRecord = await this.jobRecordRepository.findOne({ where: { id } });
    if (!jobRecord) {
      throw new UserInputError(`No JobRecord with id ${id} exists`);
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
    if (!this.jobRecordRepository) {
      throw new UserInputError('TransactionalConnection is not available');
    }
    return this.jobRecordRepository
      .find({ where: { id: In(ids) } })
      .then((records) => records.map(this.fromRecord));
  }

  async removeSettledJobs(
    queueNames: string[],
    olderThan?: Date | undefined
  ): Promise<number> {
    if (!this.jobRecordRepository) {
      throw new UserInputError('TransactionalConnection is not available');
    }
    const result = await this.jobRecordRepository.delete({
      ...(0 < queueNames.length ? { queueName: In(queueNames) } : {}),
      isSettled: true,
      settledAt: LessThan(olderThan ?? new Date()),
    });
    return result.affected || 0;
  }

  async cancelJob(jobId: ID): Promise<Job<any> | undefined> {
    await this.jobRecordRepository.delete({ id: jobId });
    return;
  }

  destroy() {
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
    // Store record saying that the task is PENDING, because we don't distinguish between pending and running
    const jobRecord = await this.jobRecordRepository.save(
      new JobRecord({
        queueName: queueName,
        data: job.data,
        attempts: job.attempts,
        state: JobState.PENDING,
        startedAt: job.startedAt,
        createdAt: job.createdAt,
        isSettled: false,
        retries: job.retries || this.options.defaultJobRetries || 3,
        progress: 0,
      })
    );
    const cloudTaskMessage: CloudTaskMessage = {
      id: jobRecord.id,
      queueName: jobRecord.queueName,
      data: jobRecord.data,
      createdAt: jobRecord.createdAt,
      maxRetries: jobRecord.retries,
    };
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
        return new Job<any>(jobRecord);
      } catch (e: any) {
        currentAttempt += 1;
        Logger.error(
          `Failed to add task to queue ${queueName}: ${e?.message}`,
          CloudTasksPlugin.loggerCtx,
          e
        );
        if (currentAttempt === (this.options.createTaskRetries ?? 5)) {
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

  getAllQueueNames(): string[] {
    return Array.from(PROCESS_MAP.keys());
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
