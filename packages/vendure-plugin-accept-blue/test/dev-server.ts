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
import { AcceptBlueTestCheckoutPlugin } from './helpers/accept-blue-test-checkout.plugin';
import {
  ADD_ITEM_TO_ORDER,
  ADD_PAYMENT_TO_ORDER,
  CREATE_PAYMENT_METHOD,
  GET_ORDER_BY_CODE,
  REFUND_TRANSACTION,
  SET_SHIPPING_METHOD,
  TRANSITION_ORDER_TO,
} from './helpers/graphql-helpers';
import { NoncePaymentMethodInput } from '../src/types';
import { add } from 'date-fns';
import { TestSubscriptionStrategy } from './helpers/test-subscription-strategy';
import { SetShippingAddress } from '../../test/src/generated/shop-graphql';

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
    dbConnectionOptions: {
      // autoSave: true, // Uncomment this line to persist the database between restarts
    },
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
      AcceptBluePlugin.init({
        // vendureHost: process.env.VENDURE_HOST as string,
        // Our temp webhook to catch the webhook from Accept Blue. View on: https://webhook.site/#!/view/cdef50e0-0e6d-4e23-a4b1-6ffc9ca89df8/2077d0c4-7cfb-4c81-b966-370ba5a44d7e/1
        vendureHost:
          'https://webhook.site/cdef50e0-0e6d-4e23-a4b1-6ffc9ca89df8',
        subscriptionStrategy: new TestSubscriptionStrategy(),
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
      // eslint-disable-next-line
      ...require('../../test/src/initial-data').initialData,
      shippingMethods: [{ name: 'Standard Shipping', price: 0 }],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });

  const port = config.apiOptions?.port ?? '';
  console.log(`Vendure server now running on port ${port}`);
  console.log('Test tokenization:', `http://localhost:${port}/checkout`);
  console.log('Test Google Pay:', `http://localhost:${port}/google-pay`);

  // Create Accept Blue payment method
  await adminClient.asSuperAdmin();
  await adminClient.query(CREATE_PAYMENT_METHOD, {
    input: {
      code: 'accept-blue',
      enabled: true,
      handler: {
        code: acceptBluePaymentHandler.code,
        arguments: [
          { name: 'apiKey', value: process.env.API_KEY },
          { name: 'pin', value: process.env.PIN },
          { name: 'testMode', value: 'true' },
          { name: 'allowECheck', value: 'true' },
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

  // Prepare sample order
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: '3',
    quantity: 1,
  });
  console.log(`Added item`);
  await shopClient.query(SetShippingAddress, {
    input: {
      fullName: 'Hayden Shipping Name',
      streetLine1: 'Hayden Shipping Street 1',
      streetLine2: 'Hayden Shipping Street 2',
      city: 'City of Hayden',
      postalCode: '1234 XX',
      countryCode: 'US',
    },
  });
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

  return;
  // Add payment
  // Use this metadata in AddpaymentToOrder to use a one time nonce for payment method creation
  const metadata: NoncePaymentMethodInput = {
    source: 'nonce-h301nyq2kycko8b6v6sr',
    last4: '1115',
    expiry_year: 2030,
    expiry_month: 3,
  };

  try {
    const { addPaymentToOrder } = await shopClient.query(ADD_PAYMENT_TO_ORDER, {
      input: {
        method: 'accept-blue',
        // metadata,
        metadata: { paymentMethodId: 14556 }, // Use a saved payment method
      },
    });
    console.log(
      `Successfully transitioned order to ${addPaymentToOrder.state}`
    );

    // Attempt a refund
    // const { refundAcceptBlueTransaction } = await shopClient.query(
    //   REFUND_TRANSACTION,
    //   {
    //     transactionId: 354653,
    //   }
    // );
    // console.log(`Refunded transaction: ${refundAcceptBlueTransaction}`);
  } catch (e) {
    // Catch to prevent server from terminating
    console.error(e);
  }
})();
