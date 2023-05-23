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
// @ts-ignore
import ngrok from 'ngrok';
import { CloudTasksPlugin } from '../src/cloud-tasks.plugin';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  require('dotenv').config();
  // process.env.PUBLIC_VENDURE_URL = await ngrok.connect(3050);
  testConfig.plugins.push(
    CloudTasksPlugin.init({
      taskHandlerHost: process.env.PUBLIC_VENDURE_URL!,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
      location: process.env.TASKQUEUE_LOCATION!,
      authSecret: 'some-secret-to-authenticate-cloud-tasks',
      queueSuffix: 'plugin-test2',
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
