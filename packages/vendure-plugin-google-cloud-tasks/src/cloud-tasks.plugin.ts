import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
  Logger,
} from '@vendure/core';
import { CloudTasksJobQueueStrategy } from './cloud-tasks-job-queue.strategy';
import { CloudTasksController } from './cloud-tasks-controller';
import { CloudTasksService } from './cloud-tasks-service';
import { CloudTaskOptions } from './types';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [CloudTasksController],
  entities: [JobRecord],
  providers: [
    CloudTasksService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => CloudTasksPlugin.options,
    },
  ],
  configuration: (config: RuntimeVendureConfig) => {
    config.jobQueueOptions.jobQueueStrategy = new CloudTasksJobQueueStrategy();
    return config;
  },
  compatibility: '^2.0.0',
})
export class CloudTasksPlugin {
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
        loggerCtx,
      );
    }
    return CloudTasksPlugin;
  }
}
