import {
  DefaultLogger,
  InitialData,
  Logger,
  LogLevel,
  mergeConfig,
  ProductEvent,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { EmailPlugin, TemplateLoader } from '@vendure/email-plugin';
import { initialData } from '../../test/src/initial-data';
import {
  AlertingPlugin,
  EventAlert,
  LogAlert,
  WebhookNotifier,
  EmailNotifier,
} from '../src';
require('dotenv').config();

class DummyTemplateLoader implements TemplateLoader {
  async loadTemplate(): Promise<string> {
    return '{{ body }}';
  }
}

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  (testConfig.dbConnectionOptions as any).autoSave = true;

  const slack = new WebhookNotifier({
    name: 'slack',
    url: process.env.SLACK_WEBHOOK!,
  });

  const emailNotifier = new EmailNotifier({
    name: 'email',
    from: 'noreply@pinelab.studio',
    to: process.env.EMAIL!,
    transport: {
      type: 'smtp',
      host: 'smtp.zeptomail.eu',
      port: 587,
      secure: false,
      logging: false,
      debug: true,
      auth: {
        user: 'emailapikey',
        pass: process.env.ZEPTOMAIL_KEY,
      },
    },
  });

  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      EmailPlugin.init({
        templateLoader: new DummyTemplateLoader(),
        transport: {
          type: 'smtp',
          host: 'smtp.zeptomail.eu',
          port: 587,
          secure: false,
          logging: false,
          debug: true,
          auth: {
            user: 'emailapikey',
            pass: process.env.ZEPTOMAIL_KEY,
          },
        },
        handlers: [],
      }),
      AlertingPlugin.init({
        alerts: [
          new EventAlert([slack, emailNotifier])
            .on(ProductEvent)
            .notify((e) => `Product event: ${e.type}`),

          new LogAlert([slack, emailNotifier])
            .onLog('error')
            .filter((log) => log.loggerCtx === 'DevServer')
            .notify((log) => ({
              subject: `[${log.level}] ${log.loggerCtx}`,
              text: log.message,
            })),
        ],
      }),
    ],
  });

  const { server } = createTestEnvironment(config);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  console.log('Dev server started');
  await new Promise((r) => setTimeout(r, 300));
  Logger.error(
    `This is a serious error! Should be notified in slack and email!`,
    'DevServer'
  );
})();
