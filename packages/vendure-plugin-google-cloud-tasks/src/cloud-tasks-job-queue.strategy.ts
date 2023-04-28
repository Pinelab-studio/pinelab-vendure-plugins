import { CloudTasksClient, Tasks } from '@google-cloud/tasks';
import ITask from '@google-cloud/tasks';
import { Job, JobData, JobQueueStrategy, Logger } from '@vendure/core';
import { CloudTasksPlugin } from './cloud-tasks.plugin';
import { CloudTaskMessage, CloudTaskOptions } from './types';
import { JobState } from '@vendure/common/lib/generated-types';

const LIVE_QUEUES = new Set<string>();

export type QueueProcessFunction = (job: Job) => Promise<any>;
export const PROCESS_MAP = new Map<string, QueueProcessFunction>();

export class CloudTasksJobQueueStrategy implements JobQueueStrategy {
  private client: CloudTasksClient;

  constructor(private options: CloudTaskOptions) {
    this.client = new CloudTasksClient();
  }

  async add<Data extends JobData<Data> = {}>(
    job: Job<Data>
  ): Promise<Job<Data>> {
    const queueName = this.getQueueName(job.queueName);
    if (!LIVE_QUEUES.has(queueName)) {
      await this.createQueue(queueName);
    }
    try {
      const cloudTaskMessage: CloudTaskMessage = {
        id: `${queueName}-${Date.now()}`,
        queueName: queueName,
        data: job.data,
        createdAt: new Date(),
        maxRetries: job.retries || this.options.defaultRetries || 3,
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
          body: Buffer.from(JSON.stringify(cloudTaskMessage)).toString(
            'base64'
          ),
        },
      };
      const request = { parent, task };
      let reply = null;
      while (!reply) {
        reply = await this.client.createTask(request, {
          maxRetries: cloudTaskMessage.maxRetries,
        });
        console.log(reply);
      }
      Logger.debug(
        `Added job with retries=${cloudTaskMessage.maxRetries} to queue ${queueName}: ${cloudTaskMessage.id} for ${task.httpRequest.url}`,
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
        retries: job.retries,
      });
    } catch (e) {
      Logger.error(
        `Failed to add task to queue ${queueName}: ${e?.message}`,
        CloudTasksPlugin.loggerCtx,
        e
      );
      throw e;
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
