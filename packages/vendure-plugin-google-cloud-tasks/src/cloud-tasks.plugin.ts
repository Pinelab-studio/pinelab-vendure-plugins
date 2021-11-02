import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { CloudTasksJobQueueStrategy } from './cloud-tasks-job-queue.strategy';
import { json } from 'body-parser';
import { CloudTasksHandler } from './cloud-tasks.handler';
import { CloudTaskOptions, ROUTE } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [CloudTasksHandler],
  configuration: (config: RuntimeVendureConfig) => {
    config.jobQueueOptions.jobQueueStrategy = new CloudTasksJobQueueStrategy(
      CloudTasksPlugin.options
    );
    config.apiOptions.middleware = [
      { route: `/${ROUTE}`, handler: json() },
      ...config.apiOptions.middleware,
    ];
    return config;
  },
})
export class CloudTasksPlugin {
  static loggerCtx = 'CloudTaskPlugin';
  static options: CloudTaskOptions;

  static init(options: CloudTaskOptions): typeof CloudTasksPlugin {
    this.options = options;
    return CloudTasksPlugin;
  }
}
