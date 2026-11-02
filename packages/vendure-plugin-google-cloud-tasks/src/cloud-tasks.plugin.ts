import {
  JobRecordBuffer,
  Logger,
  PluginCommonModule,
  RuntimeVendureConfig,
  SqlJobBufferStorageStrategy,
  VendurePlugin,
} from '@vendure/core';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';
import { CloudTasksController } from './api/cloud-tasks-controller';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { CloudTasksJobQueueStrategy } from './services/cloud-tasks-job-queue.strategy';
import { CloudTasksService } from './services/cloud-tasks-service';
import { CloudTaskOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [CloudTasksController],
  entities: [JobRecord, JobRecordBuffer],
  providers: [
    CloudTasksService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => CloudTasksPlugin.options,
    },
  ],
  configuration: (config: RuntimeVendureConfig) => {
    config.jobQueueOptions.jobQueueStrategy = new CloudTasksJobQueueStrategy();
    config.jobQueueOptions.jobBufferStorageStrategy =
      new SqlJobBufferStorageStrategy();
    return config;
  },
  compatibility: '>=2.2.0',
})
export class CloudTasksPlugin {
  static options: CloudTaskOptions;

  static init(options: CloudTaskOptions): typeof CloudTasksPlugin {
    CloudTasksPlugin.options = {
      clearStaleJobsAfterDays: 30,
      ...options,
    };
    if (
      CloudTasksPlugin.options?.createTaskRetries &&
      CloudTasksPlugin.options?.createTaskRetries > 20
    ) {
      CloudTasksPlugin.options.createTaskRetries = 20;
      Logger.warn(
        `createTaskRetries can be set to a maximum of 20 retries. This is to avoid too many stacked create task retries`,
        loggerCtx,
      );
    }
    return CloudTasksPlugin;
  }
}
