import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
  Logger,
  JobRecordBuffer,
  SqlJobBufferStorageStrategy,
} from '@vendure/core';
import { CloudTasksJobQueueStrategy } from './services/cloud-tasks-job-queue.strategy';
import { CloudTasksController } from './api/cloud-tasks-controller';
import { CloudTasksService } from './services/cloud-tasks-service';
import { CloudTaskOptions } from './types';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';

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
    this.options = {
      clearStaleJobsAfterDays: 30,
      ...options,
    };
    if (
      this.options?.createTaskRetries &&
      this.options?.createTaskRetries > 20
    ) {
      this.options.createTaskRetries = 20;
      Logger.warn(
        `createTaskRetries can be set to a maximum of 20 retries. This is to avoid too many stacked create task retries`,
        loggerCtx
      );
    }
    return CloudTasksPlugin;
  }
}
