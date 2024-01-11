//  https://sandbox.emeraldworldpayments.com/login
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LanguageCode,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { AcceptBluePlugin } from '../src';
import { acceptBluePaymentHandler } from '../src/api/accept-blue-handler';
import { CreditCardPaymentMethodInput } from '../src/types';
import {
  ADD_ITEM_TO_ORDER,
  ADD_PAYMENT_TO_ORDER,
  CREATE_PAYMENT_METHOD,
  SET_SHIPPING_METHOD,
  TRANSITION_ORDER_TO,
} from './helpers';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  // eslint-disable-next-line
  require('dotenv').config();
  // eslint-disable-next-line
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    authOptions: {
      cookieOptions: {
        secret: '123',
      },
    },
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      AcceptBluePlugin.init({}),
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
      // eslint-disable-next-line
      ...require('../../test/src/initial-data').initialData,
      shippingMethods: [{ name: 'Standard Shipping', price: 0 }],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
  // Create Accept Blue payment method
  await adminClient.asSuperAdmin();
  await adminClient.query(CREATE_PAYMENT_METHOD, {
    input: {
      code: 'accept-blue-credit-card',
      enabled: true,
      handler: {
        code: acceptBluePaymentHandler.code,
        arguments: [{ name: 'apiKey', value: process.env.API_KEY }],
      },
      translations: [
        {
          languageCode: LanguageCode.en,
          name: 'Accept blue test payment',
        },
      ],
    },
  });
  console.log(`Created paymentMethod`);
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: '1',
    quantity: 1,
  });
  console.log(`Added item`);
  await shopClient.query(SET_SHIPPING_METHOD, {
    id: [1],
  });
  console.log(`Shipping method set`);
  const { transitionOrderToState } = await shopClient.query(
    TRANSITION_ORDER_TO,
    {
      state: 'ArrangingPayment',
    }
  );

  // Create Payment method with Accept blue
  // No guest checkouts allowed

  // Get available Accept blue payment methods

  console.log(`Transitioned to ArrangingPayment`, transitionOrderToState);

  const metadata: CreditCardPaymentMethodInput = {
    // acceptBluePaymentMethod: 1,
    card: '4761530001111118',
    expiry_year: 2025,
    expiry_month: 1,
    avs_address: 'Testing address',
    avs_zip: '12345',
    name: 'Hayden Zieme',
  };

  const { addPaymentToOrder } = await shopClient.query(ADD_PAYMENT_TO_ORDER, {
    input: {
      method: 'accept-blue-credit-card',
      metadata,
    },
  });
  console.log(JSON.stringify(addPaymentToOrder));
})();
