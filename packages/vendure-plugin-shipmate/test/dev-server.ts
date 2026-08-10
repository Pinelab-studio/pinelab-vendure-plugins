import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { ChannelService, RequestContext, VendureConfig } from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { createSettledOrder } from '../../test/src/shop-utils';
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
    customerCount: 5,
  });
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
      shipmateApiKey: process.env.SHIPMATE_API_KEY!,
      shipmateUsername: process.env.SHIPMATE_USERNAME!,
      shipmatePassword: process.env.SHIPMATE_PASSWORD!,
      shipmateWebhookAuthTokens: [
        process.env.SHIPMATE_WEBHOOK_AUTH_TOKEN1!,
        process.env.SHIPMATE_WEBHOOK_AUTH_TOKEN2!,
      ],
    },
  });
  console.log('Created Shipmate Config');
  const res = await createSettledOrder(
    shopClient,
    1,
    true,
    undefined,
    undefined,
    {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: 'SA35 0AE',
        countryCode: 'GB',
      },
    }
  );
  console.log(`Placed order ${res.code}`);
})();
