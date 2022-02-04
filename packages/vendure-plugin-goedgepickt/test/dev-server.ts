import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
  mergeConfig,
  OrderService,
  ShippingMethodService,
  TransactionalConnection,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { GoedgepicktService } from '../src/api/goedgepickt.service';
import { createSettledOrder } from '../../test/src/order-utils';
import { goedgepicktHandler } from '../src';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';
import { GoedgepicktPlugin } from '../src';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { GoedgepicktConfigEntity } from '../src/api/goedgepickt-config.entity';
import localtunnel from 'localtunnel';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const tunnel = await localtunnel({ port: 3050 });
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      GoedgepicktPlugin.init({
        vendureHost: tunnel.url,
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
  const { server } = createTestEnvironment(config);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });

  const goedgepicktService = server.app.get(GoedgepicktService);
  const connection = server.app.get(TransactionalConnection);
  //set config
  require('dotenv').config();
  await connection.getRepository(GoedgepicktConfigEntity).insert({
    channelToken: 'e2e-default-channel',
    apiKey: process.env.GOEDGEPICKT_APIKEY!,
    webshopUuid: process.env.GOEDGEPICKT_WEBSHOPUUID!,
  });
  const ctx = await goedgepicktService.getCtxForChannel('e2e-default-channel');
  await server.app.get(ShippingMethodService).update(ctx, {
    id: 1,
    fulfillmentHandler: goedgepicktHandler.code,
    translations: [],
  });
  const order = await createSettledOrder(server.app, ctx as any, 1);
  const fulfillment = (await server.app
    .get(OrderService)
    .createFulfillment(ctx, {
      handler: { code: goedgepicktHandler.code, arguments: [] },
      lines: order.lines.map((line) => ({
        orderLineId: line.id,
        quantity: line.quantity,
      })),
    })) as Fulfillment;
})();
