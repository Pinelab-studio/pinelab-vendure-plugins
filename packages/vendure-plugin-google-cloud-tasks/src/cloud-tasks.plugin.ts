import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
  Logger,
} from '@vendure/core';
import { CloudTasksJobQueueStrategy } from './cloud-tasks-job-queue.strategy';
import { CloudTasksHandler } from './cloud-tasks.handler';
import { CloudTaskOptions } from './types';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [CloudTasksHandler],
  entities: [JobRecord],
  configuration: (config: RuntimeVendureConfig) => {
    config.jobQueueOptions.jobQueueStrategy = new CloudTasksJobQueueStrategy(
      CloudTasksPlugin.options
    );
    return config;
  },
  compatibility: '^2.0.0',
})
export class CloudTasksPlugin {
  static loggerCtx = 'CloudTaskPlugin';
  static options: CloudTaskOptions;

  static init(options: CloudTaskOptions): typeof CloudTasksPlugin {
    this.options = options;
    if (
      this.options?.createTaskRetries &&
      this.options?.createTaskRetries > 20
    ) {
      this.options.createTaskRetries = 20;
      Logger.warn(
        `createTaskRetries can be set to a maximum of 20 retries. This is to avoid too many stacked create task retries`,
        this.loggerCtx
      );
    }
    return CloudTasksPlugin;
  }
}
