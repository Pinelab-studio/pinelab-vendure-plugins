import { JobListOptions } from '@vendure/common/lib/generated-types';
import {
  ID,
  Injector,
  InspectableJobQueueStrategy,
  Job,
  JobData,
  PaginatedList,
} from '@vendure/core';
import { CloudTasksService } from './cloud-tasks-service';

export class CloudTasksJobQueueStrategy implements InspectableJobQueueStrategy {
  private service!: CloudTasksService;

  init(injector: Injector): void | Promise<void> {
    this.service = injector.get(CloudTasksService);
  }

  async add<Data extends JobData<Data> = {}>(
    job: Job<Data>,
  ): Promise<Job<Data>> {
    return await this.service.add(job);
  }

  /**
   * Starts the job queue.
   */
  async start<Data extends JobData<Data> = {}>(
    originalQueueName: string,
    process: (job: Job<Data>) => Promise<any>,
  ) {
    await this.service.start(originalQueueName, process);
  }

  /**
   * Stops the job queue
   */
  async stop<Data extends JobData<Data> = {}>(
    queueName: string,
    _process: (job: Job<Data>) => Promise<any>,
  ) {
    await this.service.stop(queueName, _process);
  }

  async findOne(id: ID): Promise<Job<any> | undefined> {
    return await this.service.findJob(id);
  }

  async findMany(
    options?: JobListOptions | undefined,
  ): Promise<PaginatedList<Job<any>>> {
    return await this.service.findJobs(options);
  }

  async findManyById(ids: ID[]): Promise<Job<any>[]> {
    return await this.service.findJobsById(ids);
  }

  async removeSettledJobs(
    queueNames?: string[] | undefined,
    olderThan?: Date | undefined,
  ): Promise<number> {
    return await this.service.removeSettledJobs(queueNames || [], olderThan);
  }

  async cancelJob(jobId: ID): Promise<Job<any> | undefined> {
    return await this.service.cancelJob(jobId);
  }
}
