import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { CloudTasksPlugin } from '../src/cloud-tasks.plugin';

require('dotenv').config();
testConfig.apiOptions.middleware;
export const devConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  plugins: [
    CloudTasksPlugin.init({
      taskHandlerHost: process.env.PUBLIC_VENDURE_URL!,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
      location: process.env.TASKQUEUE_LOCATION!,
      authSecret: 'some-secret-to-authenticate-cloud-tasks',
      queueSuffix: 'plugin-test',
    }),
  ],
});
