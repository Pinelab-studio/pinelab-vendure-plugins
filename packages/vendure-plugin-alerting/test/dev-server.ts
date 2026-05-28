import {
  DefaultLogger,
  InitialData,
  Logger,
  LogLevel,
  ProductEvent,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { AlertingPlugin, EventAlert, LogAlert, WebhookNotifier } from '../src';
require('dotenv').config();

(async () => {
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  (testConfig.dbConnectionOptions as any).autoSave = true;

  const slack = new WebhookNotifier({
    name: 'slack',
    url: process.env.SLACK_WEBHOOK!,
  });

  testConfig.plugins.push(
    AlertingPlugin.init({
      alerts: [
        new EventAlert([slack])
          .on(ProductEvent)
          .notify((e) => `Product event: ${e.type}`),

        new LogAlert([slack])
          .onLog('error')
          .filter((log) => log.loggerCtx === 'DevServer')
          .notify((log) => ({
            subject: `[${log.level}] ${log.loggerCtx}`,
            text: log.message,
          })),
      ],
    })
  );

  const { server } = createTestEnvironment(testConfig);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  console.log('Dev server started');
  await new Promise((r) => setTimeout(r, 300));
  Logger.error(
    `This is a serious error! Should be notified in slack!`,
    'DevServer'
  );
})();
