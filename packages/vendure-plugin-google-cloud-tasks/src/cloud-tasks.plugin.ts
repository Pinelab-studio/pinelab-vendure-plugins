import {
  Logger,
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from "@vendure/core";
import { CloudTasksJobQueueStrategy } from "./cloud-tasks-job-queue.strategy";
import { CloudTasksHandler } from "./cloud-tasks.handler";
import bodyParser from "body-parser";
import http from "http";

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [CloudTasksHandler],
  configuration: (config: RuntimeVendureConfig) => {
    config.jobQueueOptions.jobQueueStrategy = new CloudTasksJobQueueStrategy(
      CloudTasksPlugin.options
    );
    return config;
  },
})
export class CloudTasksPlugin {
  static loggerCtx = "CloudTaskPlugin";
  static options: CloudTaskOptions;

  static init(options: CloudTaskOptions): typeof CloudTasksPlugin {
    this.options = options;
    return CloudTasksPlugin;
  }
}

export interface CloudTaskOptions {
  taskHandlerHost: string;
  projectId: string;
  location: string;
  /**
   * Optional suffix, I.E. for differentiating between test, acc and prod queues
   */
  queueSuffix?: string;
}
