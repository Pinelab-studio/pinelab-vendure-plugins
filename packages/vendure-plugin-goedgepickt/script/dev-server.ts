import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  Customer,
  CustomerService,
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
  mergeConfig,
  Order,
  OrderService,
  ProductService,
  RequestContext,
  ShippingMethodService,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { GoedgepicktService } from '../src/api/goedgepickt.service';
import { createSettledOrder } from '../../test/src/order-utils';
import { goedgepicktHandler } from '../src/api/goedgepickt.handler';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';
import { GoedgepicktPlugin } from '../src';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import path from 'path';
import { MyparcelPlugin } from '../../vendure-plugin-myparcel/src';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminListQueryLimit: 10000,
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      GoedgepicktPlugin.init({
        configPerChannel: [
          {
            channelToken: 'e2e-default-channel',
            apiKey: process.env.GOEDGEPICKT_APIKEY!,
            webshopUuid: process.env.GOEDGEPICKT_WEBSHOPUUID!,
            orderWebhookKey: process.env.GOEDGEPICKT_WEBHOOK_ORDERSTATUS_KEY!,
            stockWebhookKey: process.env.GOEDGEPICKT_WEBHOOK_STOCK_UPDATE_KEY!,
          },
        ],
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
  // await server.app.get(GoedgepicktService).pushProducts('e2e-default-channel');
  /*  await server.app
      .get(GoedgepicktService)
      .pullStocklevels('e2e-default-channel');*/
  const ctx = await goedgepicktService.getCtxForChannel('e2e-default-channel');

  // server.app.get(ProductService).findAll(ctx, {});
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
