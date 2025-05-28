import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  KlaviyoPlugin,
  createRefundHandler,
  defaultOrderPlacedEventHandler,
} from '../src';
import { mockCustomEventHandler } from './mock-custom-event-handler';

(async () => {
  require('dotenv').config();
  const { testConfig } = require('@vendure/testing');
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
      KlaviyoPlugin.init({
        apiKey: process.env.KLAVIYO_PRIVATE_API_KEY!,
        eventHandlers: [
          defaultOrderPlacedEventHandler,
          mockCustomEventHandler,
          createRefundHandler({
            getPaymentMethodName: (payment) => {
              // This sample gets the payment method (like 'iDeal') when a the settled payment was a Mollie payment
              return payment?.metadata.method;
            },
          }),
        ],
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
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
  const order = await createSettledOrder(shopClient, 1);
  console.log(`Created settled order '${order.code}'`);
})();
