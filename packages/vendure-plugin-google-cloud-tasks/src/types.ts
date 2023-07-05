export interface CloudTaskOptions {
  taskHandlerHost: string;
  projectId: string;
  location: string;
  authSecret: string;
  /**
   * Optional suffix, I.E. for differentiating between test, acc and prod queues
   */
  queueSuffix?: string;
  /**
   * Optional size limit to be passed to `body-parser/json`
   */
  bodySizeLimit?: string;
  /**
   * Default nr of retries a job should attempt if no job.retries is given
   */
  defaultJobRetries?: number;
  /**
   *Nr of attempts the plugin should try to push a job to the queue, in case it fails. Default is 5
   */
  createTaskRetries?: number;
}

export interface CloudTaskMessage {
  id: string | number;
  data: unknown;
  queueName: string;
  createdAt: Date;
  maxRetries: number;
}

export const ROUTE = 'cloud-tasks';
