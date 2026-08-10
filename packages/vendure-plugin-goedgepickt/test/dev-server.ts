import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  Channel,
  ShippingMethodService,
  TransactionalConnection,
  VendureConfig,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { GoedgepicktService } from '../src/api/goedgepickt.service';
import { goedgepicktHandler } from '../src';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { config } from './vendure-config';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, shopClient } = createTestEnvironment(
    config as Required<VendureConfig>
  );
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
      ggUuidApiKey: `${process.env.GOEDGEPICKT_WEBSHOPUUID}:${process.env.GOEDGEPICKT_APIKEY}`,
    },
  });
  const ctx = await goedgepicktService.getCtxForChannel('e2e-default-channel');
  await server.app.get(ShippingMethodService).update(ctx, {
    id: 1,
    fulfillmentHandler: goedgepicktHandler.code,
    translations: [],
  });
  await createSettledOrder(shopClient, 1);
})();
