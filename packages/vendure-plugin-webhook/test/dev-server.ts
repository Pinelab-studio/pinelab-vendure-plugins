import {
  AttemptedLoginEvent,
  ChannelService,
  DefaultLogger,
  DefaultSearchPlugin,
  type InitialData,
  LogLevel,
  ProductEvent,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { WebhookPlugin } from '../src';
import { Webhook } from '../src/api/webhook.entity';
import { stringifyProductTransformer } from './test-helpers';

(async () => {
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  (testConfig.dbConnectionOptions as any).autoSave = true;
  testConfig.plugins.push(
    WebhookPlugin.init({
      delay: 3000,
      events: [ProductEvent, AttemptedLoginEvent],
      requestTransformers: [stringifyProductTransformer],
    }),
  );
  testConfig.plugins.push(DefaultSearchPlugin);
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
