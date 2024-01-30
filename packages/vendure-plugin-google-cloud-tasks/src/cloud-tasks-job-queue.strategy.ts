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
import { CloudTasksService } from './cloud-tasks-service';

const LIVE_QUEUES = new Set<string>();

export type QueueProcessFunction = (job: Job) => Promise<any>;
export const PROCESS_MAP = new Map<string, QueueProcessFunction>();

export class CloudTasksJobQueueStrategy implements InspectableJobQueueStrategy {
  private service!: CloudTasksService;

  init(injector: Injector): void | Promise<void> {
    this.service = injector.get(CloudTasksService);
  }

  async add<Data extends JobData<Data> = {}>(
    job: Job<Data>
  ): Promise<Job<Data>> {
    return this.service.add(job);
  }

  /**
   * Starts the job queue.
   */
  async start<Data extends JobData<Data> = {}>(
    originalQueueName: string,
    process: (job: Job<Data>) => Promise<any>
  ) {
    this.service.start(originalQueueName, process);
  }

  /**
   * Stops the job queue
   */
  async stop<Data extends JobData<Data> = {}>(
    queueName: string,
    _process: (job: Job<Data>) => Promise<any>
  ) {
    this.service.stop(queueName, _process);
  }

  findOne(id: ID): Promise<Job<any> | undefined> {
    return this.service.findJob(id);
  }
  findMany(
    options?: JobListOptions | undefined
  ): Promise<PaginatedList<Job<any>>> {
    return this.service.findJobs(options);
  }
  findManyById(ids: ID[]): Promise<Job<any>[]> {
    return this.service.findJobsById(ids);
  }

  removeSettledJobs(
    queueNames?: string[] | undefined,
    olderThan?: Date | undefined
  ): Promise<number> {
    return this.service.removeSettledJobs(queueNames || [], olderThan);
  }

  cancelJob(jobId: ID): Promise<Job<any> | undefined> {
    return this.service.cancelJob(jobId);
  }
}
