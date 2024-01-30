import { CloudTasksClient } from '@google-cloud/tasks';
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { JobListOptions, JobState } from '@vendure/common/lib/generated-types';
import {
  ID,
  Job,
  JobData,
  JsonCompatible,
  ListQueryBuilder,
  Logger,
  PaginatedList,
} from '@vendure/core';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { CloudTaskMessage, CloudTaskOptions } from './types';

type QueueProcessFunction = (job: Job) => Promise<any>;

@Injectable()
export class CloudTasksService implements OnApplicationBootstrap {
  LIVE_QUEUES = new Set<string>();
  PROCESS_MAP = new Map<string, QueueProcessFunction>();
  readonly jobRecordRepository: Repository<JobRecord>;
  readonly client: CloudTasksClient;

  constructor(
    private readonly listQueryBuilder: ListQueryBuilder,
    @Inject(PLUGIN_INIT_OPTIONS) private readonly options: CloudTaskOptions,
    dataSource: DataSource
  ) {
    this.jobRecordRepository = dataSource.getRepository(JobRecord);
    this.client = new CloudTasksClient(options.clientOptions);
  }

  onApplicationBootstrap() {
    const daysAgo30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.removeAllJobs(daysAgo30)
      .then(() => {
        Logger.info(`Removed settled jobs`, loggerCtx);
      })
      .catch((e: any) => {
        Logger.error(
          `Failed to remove settled jobs: ${e?.message}`,
          loggerCtx,
          e?.stack
        );
      });
  }

  async findJob(id: ID): Promise<Job<any> | undefined> {
    const jobRecord = await this.jobRecordRepository.findOne({ where: { id } });
    if (!jobRecord) {
      return undefined;
    }
    return new Job(jobRecord);
  }

  async findJobs(
    options?: JobListOptions | undefined
  ): Promise<PaginatedList<Job<any>>> {
    return this.listQueryBuilder
      .build(JobRecord, options)
      .getManyAndCount()
      .then(([items, totalItems]) => ({
        items: items.map(this.fromRecord),
        totalItems,
      }));
  }

  async findJobsById(ids: ID[]): Promise<Job<any>[]> {
    return this.jobRecordRepository
      .find({ where: { id: In(ids) } })
      .then((records) => records.map(this.fromRecord));
  }

  async removeSettledJobs(
    queueNames: string[],
    olderThan?: Date | undefined
  ): Promise<number> {
    const result = await this.jobRecordRepository.delete({
      ...(0 < queueNames.length ? { queueName: In(queueNames) } : {}),
      isSettled: true,
      settledAt: LessThan(olderThan ?? new Date()),
    });
    return result.affected || 0;
  }

  /**
   * Remove all jobs older than given date.
   * All queues, settled or unsettled
   */
  async removeAllJobs(olderThan: Date): Promise<void> {
    await this.jobRecordRepository.delete({
      createdAt: LessThan(olderThan),
    });
  }

  async cancelJob(jobId: ID): Promise<Job<any> | undefined> {
    await this.jobRecordRepository.delete({ id: jobId });
    return;
  }

  async add<Data extends JobData<Data> = {}>(
    job: Job<Data>
  ): Promise<Job<Data>> {
    const queueName = this.getQueueName(job.queueName);
    if (!this.LIVE_QUEUES.has(queueName)) {
      await this.createQueue(queueName);
    }
    const retries = job.retries || this.options.defaultJobRetries || 3;
    // Store record saying that the task is PENDING, because we don't distinguish between pending and running
    const jobRecord = await this.saveWithRetry(
      new JobRecord({
        id: job.id,
        queueName: queueName,
        data: job.data,
        attempts: job.attempts,
        state: JobState.PENDING,
        startedAt: job.startedAt,
        createdAt: job.createdAt,
        isSettled: false,
        retries,
        progress: 0,
      })
    );
    const cloudTaskMessage: CloudTaskMessage = {
      id: jobRecord.id,
      queueName: queueName,
      data: job.data,
      createdAt: job.createdAt,
      maxRetries: retries,
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
        const res = await this.client.createTask(request, {
          maxRetries: cloudTaskMessage.maxRetries,
        });
        Logger.debug(
          `Added job (${cloudTaskMessage.id}) with retries=${cloudTaskMessage.maxRetries} to queue ${queueName} for ${task.httpRequest.url}`,
          loggerCtx
        );
        return new Job<any>(jobRecord);
      } catch (e: any) {
        currentAttempt += 1;
        if (currentAttempt === (this.options.createTaskRetries ?? 5)) {
          Logger.error(
            `Failed to add task to queue ${queueName} in ${currentAttempt} attempts. Not retrying anymore! Error: ${e?.message}`,
            loggerCtx,
            (e as Error)?.stack
          );
          throw e;
        }
        Logger.warn(
          `Failed to add task to queue ${queueName} in attempt nr ${currentAttempt}: ${e?.message}`,
          loggerCtx
        );
        // Exponential backoff after first 3 subsequent attempts
        if (currentAttempt > 3) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 2 ** currentAttempt)
          );
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
    this.PROCESS_MAP.set(queueName, process);
    Logger.info(`Started queue ${queueName}`, loggerCtx);
  }

  getAllQueueNames(): string[] {
    return Array.from(this.PROCESS_MAP.keys());
  }

  /**
   * Handle incoming Cloud task message. Returns the HTTP status code to return to the Cloud Task.
   */
  async handleIncomingJob(
    message: CloudTaskMessage,
    attemptsHeader?: string
  ): Promise<200 | 500> {
    Logger.debug(`Received Cloud Task message ${message.id}`, loggerCtx);
    const processFn = this.PROCESS_MAP.get(message.queueName);
    if (!processFn) {
      Logger.error(
        `No process function found for queue ${message.queueName}`,
        loggerCtx
      );
      return 500;
    }
    const attempts = attemptsHeader ? parseInt(attemptsHeader) : 0;
    const job = new Job({
      id: message.id,
      queueName: message.queueName,
      data: message.data as JsonCompatible<unknown>,
      attempts: attempts,
      state: JobState.RUNNING,
      startedAt: new Date(),
      createdAt: message.createdAt,
      retries: message.maxRetries,
    });
    try {
      await processFn(job);
      // The job was completed successfully
      Logger.debug(
        `Successfully handled ${message.id} after ${attempts} attempts`,
        loggerCtx
      );
      await this.saveWithRetry(
        new JobRecord({
          id: job.id,
          queueName: job.queueName,
          data: job.data,
          attempts: job.attempts,
          state: JobState.COMPLETED,
          startedAt: job.startedAt,
          createdAt: job.createdAt,
          retries: job.retries,
          isSettled: true,
          settledAt: new Date(),
          progress: 100,
        })
      );
      return 200;
    } catch (error: any) {
      if (this.options.onJobFailure) {
        try {
          await this.options.onJobFailure(error);
        } catch (e: any) {
          Logger.error(`Error in 'onJobFailure': ${e}`, loggerCtx);
        }
      }
      if (attempts === job.retries) {
        // This was the final attempt, so mark the job as failed
        Logger.error(
          `Failed to handle message ${message.id} after final attempt (${attempts} attempts made). Marking with status 200 to prevent retries: ${error}`,
          loggerCtx
        );
        // Log failed job in DB
        await this.saveWithRetry(
          new JobRecord({
            id: job.id,
            queueName: job.queueName,
            data: job.data,
            attempts: job.attempts,
            state: JobState.FAILED,
            startedAt: job.startedAt,
            createdAt: job.createdAt,
            retries: job.retries,
            isSettled: true,
            settledAt: new Date(),
            progress: 0,
            result: error?.message ?? error.toString(),
          })
        ).catch((e: any) => {
          Logger.error(`Failed `, loggerCtx);
        });
        return 200; // Return 200 to prevent more retries
      } else {
        // More attempts remain, so return 500 to trigger a retry
        Logger.warn(
          `Failed to handle message ${message.id} after ${attempts} attempts. Retrying... ${error}`,
          loggerCtx
        );
        return 500;
      }
    }
  }

  /**
   * Stops the job queue
   */
  async stop<Data extends JobData<Data> = {}>(
    queueName: string,
    _process: (job: Job<Data>) => Promise<any>
  ) {
    this.PROCESS_MAP.delete(this.getQueueName(queueName));
    Logger.info(`Stopped queue ${this.getQueueName(queueName)}`, loggerCtx);
  }

  /**
   * Save the job record with a retry when the data is too long
   */
  private async saveWithRetry(jobRecord: JobRecord): Promise<JobRecord> {
    try {
      return await this.jobRecordRepository.save(jobRecord);
    } catch (e: any) {
      if (e?.message?.indexOf('ER_DATA_TOO_LONG') > -1) {
        // Save job without data
        jobRecord.data = undefined;
        return await this.jobRecordRepository.save(jobRecord);
      }
      throw e;
    }
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

  private fromRecord(this: void, jobRecord: JobRecord): Job<any> {
    return new Job<any>(jobRecord);
  }

  private async createQueue(queueName: string): Promise<void> {
    if (this.LIVE_QUEUES.has(queueName)) {
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
      this.LIVE_QUEUES.add(queueName);
    } catch (error: any) {
      if (error?.message?.indexOf('ALREADY_EXISTS') > -1) {
        this.LIVE_QUEUES.add(queueName);
        Logger.debug(`Queue ${queueName} already exists`, loggerCtx);
      } else {
        throw error;
      }
    }
  }
}
