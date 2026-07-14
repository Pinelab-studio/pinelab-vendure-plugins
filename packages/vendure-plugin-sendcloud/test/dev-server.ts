import { initialData } from '../../test/src/initial-data';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  ChannelService,
  RequestContext,
  VendureConfig,
} from '@vendure/core';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { sendcloudHandler } from '../src';
import { addShippingMethod, updateVariants } from '../../test/src/admin-utils';
import { createSettledOrder } from '../../test/src/shop-utils';
import { GlobalFlag } from '../../test/src/generated/admin-graphql';
import { config } from './vendure-config';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, adminClient, shopClient } = createTestEnvironment(
    config as Required<VendureConfig>
  );
  await server.init({
    initialData: {
      ...initialData,
      shippingMethods: [],
      paymentMethods: [
        {
          name: testPaymentMethod.code,
          handler: { code: testPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
    customerCount: 2,
  });
  await addShippingMethod(adminClient, sendcloudHandler.code);
  await adminClient.asSuperAdmin();

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
      sendcloudSecret: process.env.SECRET!,
      sendcloudPublicKey: process.env.PUBLIC!,
      sendcloudDefaultPhoneNr: '058123456789',
    },
  });

  await updateVariants(adminClient, [
    { id: 'T_1', trackInventory: GlobalFlag.True },
  ]);
  await createSettledOrder(shopClient, 1, true, [{ id: 'T_1', quantity: 1 }]);
  console.log('created test order');
})();
