import { ClientOptions } from 'google-gax';

export interface CloudTaskOptions {
  taskHandlerHost: string;
  projectId: string;
  location: string;
  authSecret: string;
  /**
   * Custom error handler for when a job fails.
   * Useful for when you'd like to inspect specific errors in your project.
   */
  onJobFailure?: (error: any) => void | Promise<void>;
  /**
   * Optional suffix, I.E. for differentiating between test, acc and prod queues
   */
  queueSuffix?: string;
  /**
   * Default nr of retries a job should attempt if no job.retries is given
   */
  defaultJobRetries?: number;
  /**
   * Nr of attempts the plugin should try to push a job to the queue, in case it fails. Default is 5, maximum is 20.
   */
  createTaskRetries?: number;
  /**
   * These options will be passed into the Google cloud task client.
   */
  clientOptions?: ClientOptions;
}

export interface CloudTaskMessage {
  id: string | number;
  data: unknown;
  queueName: string;
  createdAt: Date;
  maxRetries: number;
}

export const ROUTE = 'cloud-tasks';
