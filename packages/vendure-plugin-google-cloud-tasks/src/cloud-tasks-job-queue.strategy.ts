import { CloudTasksClient } from '@google-cloud/tasks';
import {
  Job,
  JobData,
  JobQueueStrategy,
  JsonCompatible,
  Logger,
} from '@vendure/core';
import {
  CloudTaskMessage,
  CloudTaskOptions,
  CloudTasksPlugin,
} from './cloud-tasks.plugin';
import { JobState } from '@vendure/common/lib/generated-types';

export type QueueProcessFunction = (job: Job) => Promise<any>;

export class CloudTasksJobQueueStrategy implements JobQueueStrategy {
  private client: CloudTasksClient;
  /**
   * Holds the process per queuename
   */
  static processMap = new Map<string, QueueProcessFunction>();

  constructor(private options: CloudTaskOptions) {
    this.client = new CloudTasksClient();
  }

  async add<Data extends JobData<Data> = {}>(
    job: Job<Data>
  ): Promise<Job<Data>> {
    const queueName = this.getQueueName(job.queueName);
    const cloudTaskMessage: CloudTaskMessage = {
      id: `${queueName}-${Date.now()}`,
      queueName: queueName,
      data: job.data,
      createdAt: new Date(),
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
    const [response] = await this.client.createTask(request);
    Logger.debug(
      `Added job to queue ${queueName}: ${cloudTaskMessage.id} for ${task.httpRequest.url}`,
      CloudTasksPlugin.loggerCtx
    );
    return new Job({
      id: cloudTaskMessage.id,
      queueName: job.queueName,
      data: job.data,
      attempts: job.attempts,
      state: JobState.RUNNING,
      startedAt: job.startedAt,
      createdAt: job.createdAt,
    });
  }

  async start<Data extends JobData<Data> = {}>(
    originalQueueName: string,
    process: (job: Job<Data>) => Promise<any>
  ) {
    const queueName = this.getQueueName(originalQueueName);
    CloudTasksJobQueueStrategy.processMap.set(queueName, process);
    await this.createQueue(queueName);
    Logger.info(`Started queue ${queueName}`, CloudTasksPlugin.loggerCtx);
  }

  async stop<Data extends JobData<Data> = {}>(
    queueName: string,
    process: (job: Job<Data>) => Promise<any>
  ) {
    CloudTasksJobQueueStrategy.processMap.delete(this.getQueueName(queueName));
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
    try {
      await this.client.createQueue({
        parent: this.client.locationPath(
          this.options.projectId,
          this.options.location
        ),
        queue: {
          name: this.getQueuePath(queueName),
        },
      });
    } catch (error) {
      if (error?.message?.indexOf('ALREADY_EXISTS') > -1) {
        return Logger.debug(
          `Queue ${queueName} already exists`,
          CloudTasksPlugin.loggerCtx
        );
      }
      throw error;
    }
  }
}
