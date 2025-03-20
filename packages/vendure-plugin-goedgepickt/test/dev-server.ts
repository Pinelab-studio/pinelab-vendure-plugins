import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  Channel,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  ShippingMethodService,
  TransactionalConnection,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { GoedgepicktService } from '../src/api/goedgepickt.service';
import { goedgepicktHandler, GoedgepicktPlugin } from '../src';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';

(async () => {
  require('dotenv').config();
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [
      GoedgepicktPlugin.init({
        vendureHost: process.env.WEBHOOK_ENDPOINT!,
        endpointSecret: 'test',
        setWebhook: true,
        determineOrderStatus: async (ctx, order) => 'on_hold' as const,
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [GoedgepicktPlugin.ui],
          devMode: true,
        }),
      }),
    ],
  });
  const { server, shopClient } = createTestEnvironment(config);
  await server.init({
    initialData: {
      ...initialData,
      paymentMethods: [
        {
          name: testPaymentMethod.code,
          handler: { code: testPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });

  const goedgepicktService = server.app.get(GoedgepicktService);
  const connection = server.app.get(TransactionalConnection);
  //set config
  await connection.getRepository(Channel).update(1, {
    customFields: {
      ggEnabled: true,
      ggUuidApiKey: `${process.env.GOEDGEPICKT_WEBSHOPUUID}:${process.env.GOEDGEPICKT_APIKEY}`
    }
  });
  const ctx = await goedgepicktService.getCtxForChannel('e2e-default-channel');
  await server.app.get(ShippingMethodService).update(ctx, {
    id: 1,
    fulfillmentHandler: goedgepicktHandler.code,
    translations: [],
  });
  await goedgepicktService.setWebhooks(ctx);
  await goedgepicktService.handleIncomingStockUpdate(ctx, 'L2201308');
  await createSettledOrder(shopClient, 1);
})();
