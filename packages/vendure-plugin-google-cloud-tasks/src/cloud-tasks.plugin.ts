import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { CloudTasksJobQueueStrategy } from './cloud-tasks-job-queue.strategy';
import { json } from 'body-parser';
import { CloudTasksHandler } from './cloud-tasks.handler';
import { CloudTaskOptions, ROUTE } from './types';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [CloudTasksHandler],
  entities: [JobRecord],
  configuration: (config: RuntimeVendureConfig) => {
    config.jobQueueOptions.jobQueueStrategy = new CloudTasksJobQueueStrategy(
      CloudTasksPlugin.options
    );
    config.apiOptions.middleware = [
      {
        route: `/${ROUTE}`,
        beforeListen: true,
        handler: json({
          limit: CloudTasksPlugin.options.bodySizeLimit || '1mb',
        }),
      },
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
