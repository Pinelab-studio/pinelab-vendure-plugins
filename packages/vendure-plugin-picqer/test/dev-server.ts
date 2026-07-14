import { ChannelService, RequestContext, VendureConfig } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { addShippingMethod } from '../../test/src/admin-utils';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { picqerHandler } from '../src/api/picqer.handler';
import { config } from './vendure-config';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, shopClient, adminClient } = createTestEnvironment(
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
  await adminClient.asSuperAdmin();
  await addShippingMethod(adminClient, picqerHandler.code);

  const channel = await server.app.get(ChannelService).getDefaultChannel();
  const ctx = new RequestContext({
    apiType: 'admin',
    isAuthorized: true,
    authorizedAsOwnerOnly: false,
    channel,
  });
  await server.app.get(ChannelService).update(ctx, {
    id: ctx.channelId,
    customFields: {
      picqerEnabled: true,
      picqerApiKey: process.env.APIKEY,
      picqerApiEndpoint: process.env.ENDPOINT,
      picqerStorefrontUrl: 'mystore.io',
      picqerSupportEmail: 'support@mystore.io',
    },
  });

  const order = await createSettledOrder(shopClient, 3, true, [
    { id: 'T_1', quantity: 3 },
  ]);
})();
