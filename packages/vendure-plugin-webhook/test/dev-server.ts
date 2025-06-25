import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  AttemptedLoginEvent,
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
  ProductEvent,
  RequestContext,
  ChannelService,
  TransactionalConnection,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { WebhookPlugin } from '../src';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import * as path from 'path';
import { stringifyProductTransformer } from './test-helpers';
import { Webhook } from '../src/api/webhook.entity';

(async () => {
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  testConfig.plugins.push(
    WebhookPlugin.init({
      delay: 3000,
      events: [ProductEvent, AttemptedLoginEvent],
      requestTransformers: [stringifyProductTransformer],
    })
  );
  testConfig.plugins.push(DefaultSearchPlugin);
  testConfig.plugins.push(
    AdminUiPlugin.init({
      route: 'admin',
      port: 3002,
      app: compileUiExtensions({
        outputPath: path.join(__dirname, '__admin-ui'),
        extensions: [WebhookPlugin.ui],
        devMode: true,
      }),
    })
  );
  testConfig.apiOptions.shopApiPlayground = {};
  testConfig.apiOptions.adminApiPlayground = {};
  const { server } = createTestEnvironment(testConfig);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });

  // Example: Create an admin RequestContext and insert webhook entities
  console.log('Creating webhook examples...');

  // Get services from the server
  const channelService = server.app.get(ChannelService);
  const connection = server.app.get(TransactionalConnection);

  // Get the default channel
  const channel = await channelService.getDefaultChannel();

  // Create an admin RequestContext
  const ctx = new RequestContext({
    apiType: 'admin',
    isAuthorized: true,
    authorizedAsOwnerOnly: false,
    channel,
    languageCode: channel.defaultLanguageCode,
  });
  // Create a webhook entity
  const webhook = new Webhook({
    channelId: String(ctx.channelId),
    url: 'https://pinelab.requestcatcher.com/',
    event: 'ProductEvent',
    transformerName: 'Stringify Product events',
  });
  await connection.getRepository(ctx, Webhook).save(webhook);
  console.log('Webhook created successfully');
})();
