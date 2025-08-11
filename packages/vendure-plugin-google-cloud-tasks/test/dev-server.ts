import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  InitialData,
  DefaultSearchPlugin,
  DefaultLogger,
  LogLevel,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { CloudTasksPlugin } from '../src/cloud-tasks.plugin';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  require('dotenv').config();
  testConfig.plugins.push(
    CloudTasksPlugin.init({
      taskHandlerHost: process.env.PUBLIC_VENDURE_URL!,
      projectId: process.env.GCLOUD_PROJECT!,
      location: process.env.TASKQUEUE_LOCATION!,
      authSecret: 'some-secret-to-authenticate-cloud-tasks',
      queueSuffix: 'plugin-test2',
      clientOptions: {
        fallback: true,
      },
      clearStaleJobsAfterDays: 1,
    })
  );
  testConfig.plugins.push(AdminUiPlugin.init({ route: 'admin', port: 3002 }));
  testConfig.plugins.push(DefaultSearchPlugin);
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  const { server } = createTestEnvironment(testConfig);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
