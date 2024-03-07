// This import is needed to accept custom field types
import {} from '../src/api/custom-field-types';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LanguageCode,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import readline from 'readline';
import { AcceptBluePlugin } from '../src';
import { acceptBluePaymentHandler } from '../src/api/accept-blue-handler';
import { AcceptBlueTestCheckoutPlugin } from './accept-blue-test-checkout.plugin';
import {
  ADD_ITEM_TO_ORDER,
  ADD_PAYMENT_TO_ORDER,
  CREATE_PAYMENT_METHOD,
  SET_SHIPPING_METHOD,
  TRANSITION_ORDER_TO,
} from './helpers';
import { NoncePaymentMethodInput } from '../src/types';

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
  console.log(`Vendure server now running on port ${port}`);
  console.log('Accept blue checkout form', `http://localhost:${port}/checkout`);

  // Create Accept Blue payment method
  await adminClient.asSuperAdmin();
  await adminClient.query(CREATE_PAYMENT_METHOD, {
    input: {
      code: 'accept-blue-credit-card',
      enabled: true,
      handler: {
        code: acceptBluePaymentHandler.code,
        arguments: [
          { name: 'apiKey', value: process.env.API_KEY },
          { name: 'pin', value: process.env.PIN },
          {
            name: 'tokenizationSourceKey',
            value: process.env.ACCEPT_BLUE_TOKENIZATION_SOURCE_KEY ?? null,
          },
        ],
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
  console.log(
    `Transitioned order '${transitionOrderToState.code}' to ArrangingPayment`
  );

  // Create Payment method with Accept blue
  // const metadata: NoncePaymentMethodInput = {
  //   source: 'nonce-z5frsiogt4kce2paljeb',
  //   last4: '1115',
  //   expiry_year: 2030,
  //   expiry_month: 3,
  // };
  try {
    const { addPaymentToOrder } = await shopClient.query(ADD_PAYMENT_TO_ORDER, {
      input: {
        method: 'accept-blue-credit-card',
        // metadata,
        metadata: { paymentMethodId: 15713 },
      },
    });
    console.log(JSON.stringify(addPaymentToOrder));
  } catch (e) {
    // Catch to prevent server from terminating
    console.error(e);
  }
})();
