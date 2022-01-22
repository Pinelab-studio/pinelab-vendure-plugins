import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  Customer,
  CustomerService,
  InitialData,
  Order,
  OrderService, ProductService,
  RequestContext,
  ShippingMethodService
} from "@vendure/core";
import { initialData } from '../../test/src/initial-data';
import { localConfig } from './local-config';
import { GoedgepicktService } from '../src/goedgepickt.service';
import { createSettledOrder } from '../../test/src/order-utils';
import { goedgepicktHandler } from '../src/goedgepickt.handler';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const { server } = createTestEnvironment(localConfig);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });

  const goedgepicktService = server.app.get(GoedgepicktService);
  // await server.app.get(GoedgepicktService).pushProducts('e2e-default-channel');
  /*  await server.app
      .get(GoedgepicktService)
      .pullStocklevels('e2e-default-channel');*/
  const ctx = await goedgepicktService.getCtxForChannel('e2e-default-channel')

  server.app.get(ProductService).findAll(ctx, {});
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
