//  https://sandbox.emeraldworldpayments.com/login
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LanguageCode,
  LogLevel,
  VendureConfig,
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
import { AcceptBlueTestCheckoutPlugin } from './accept-blue-test-checkout.plugin';
/**
 * Ensure you have a .env in the plugin root directory with the variable ACCEPT_BLUE_TOKENIZATION_SOURCE_KEY=pk-abc123
 * The value of this key can be retrieved from the dashboard Accept Blue (Control Panel > Sources > Create Key, and choose "Tokenization" from the Source Key Type dropdown.)
 *
 */
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  // eslint-disable-next-line
  require('dotenv').config();

  const tokenizationSourceKey =
    process.env.ACCEPT_BLUE_TOKENIZATION_SOURCE_KEY ?? '';

  if (!tokenizationSourceKey.length) {
    console.log(
      "Missing Accept Blue tokenizationSourceKey. Please look it up on the dashboard and add it to the environment key 'ACCEPT_BLUE_TOKENIZATION_SOURCE_KEY'"
    );
  }

  // eslint-disable-next-line
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config: Required<VendureConfig> = mergeConfig(testConfig, {
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
      AcceptBlueTestCheckoutPlugin,
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

  const port = config.apiOptions?.port ?? '';
  console.log('\n\n========================');
  console.log(`Vendure server now running on port ${port}`);
  console.log('------------------------');
  console.log(
    'shopApi',
    `http://localhost:${port}/${config.apiOptions?.shopApiPath ?? ''}`
  );
  console.log(
    'adminApi',
    `http://localhost:${port}/${config.apiOptions?.adminApiPath ?? ''}`
  );
  // console.log('Asset server', `http://localhost:${port}/assets`);
  // console.log('Dev mailbox', `http://localhost:${port}/mailbox`);
  console.log('admin UI', `http://localhost:${port}/admin`);
  console.log('------------------------\n');
  console.log('Accept blue checkout form', `http://localhost:${port}/checkout`);
  console.log('\n------------------------');
  console.log('========================\n\n');

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
