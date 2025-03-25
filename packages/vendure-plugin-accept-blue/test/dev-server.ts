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
import {
  GooglePayPaymentMethodInput,
  NoncePaymentMethodInput,
} from '../src/types';
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
    authOptions: {},
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
          { name: 'allowGooglePay', value: 'true' },
          { name: 'allowApplePay', value: 'true' },
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

  // Add payment
  // Use this metadata in AddpaymentToOrder to use a one time nonce for payment method creation
  // const metadata: NoncePaymentMethodInput = {
  //   source: 'nonce-h301nyq2kycko8b6v6sr',
  //   last4: '1115',
  //   expiry_year: 2030,
  //   expiry_month: 3,
  // };
  const metadata: GooglePayPaymentMethodInput = {
    source: 'googlepay',
    amount: 1.0,
    token:
      '{"signature":"MEYCIQCcbiCikKwXrhn4njwr1takqr1bfoFgi/a9O0LGon9rrgIhANl7RapmJpuCkjdToRROJvkCLendCJbeM+pwqJkOFKXH","intermediateSigningKey":{"signedKey":"{\\"keyValue\\":\\"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAErFqQhiKDaajVHxIAXTChgmli9B0bJe94QUNPQ7j6/M7HX0wKrwQmtb+Ml1bdJDqmhpvMaFsrFH2CyV51BXX8WQ\\\\u003d\\\\u003d\\",\\"keyExpiration\\":\\"1743588450799\\"}","signatures":["MEYCIQDD9dOLwFdOO90iL1+ppD9GWupn3FhyiXbTU2ANHm5wugIhAKnMjC/twWWUYVXE2HOgUKX+Qbpc4qpMtSrPMm34TMzB"]},"protocolVersion":"ECv2","signedMessage":"{\\"encryptedMessage\\":\\"+8VYX9GholEw55phJyv123iCe2etV5noGjzMPrY0SJwuRVfa6wK9AawBH2POZq8dTIAy2tR1KmY3OOmkE1ZfyqnNcVUEvDt6gYZWtRfI9JYLQL04Aw2yW1SgzT5Qo6iw1Nd/0si3tuwoWnLhDJ/kuk3L+lBw2TK+XbvGSxlWTCOKSpuUDGjHAJ6PttQtW3KcD5rbigczOUKVImweACc0zVxFshqEJ4/KNuipMw23glX6nXJHPFw0+w8QEtgT20Y7tsQEjfuY/ho3li4qQZACEZ5zMAajYUm/CGlGks8t9BqCX+TLCrSnTmuKr4jQm8jad4+na9YWBtt+8nyGwvc668gDoBJ/zktKHcuEdBfwWF9iK4e3JqZeNgWIlQMSUTb8lL6eMlfWh8h/ec7gpJMtejIlEYGuce0yOed5EfJ+vHeUPn7xpoZ66tbhXfFg0+sCRDs30E69TQ4D2f8onfco3C2eGjQIDPQiEsfTYl3voDrwfU+LFL+eq+wH5K+l/GdryIJKPDa+WMHCtr71VonblQw6RtfgsWJgVBQSKkIs8M5aSZhLOsBu+iYvJ7U2CBI72Ew\\\\u003d\\",\\"ephemeralPublicKey\\":\\"BPT6t5rEa5NeoXAyBT/5Q3ARJHB/OsnH2KMksnrQz+sFmn2sI4OpO5wYcJgY0yb762pDUxARRI7hezyxUhjaoto\\\\u003d\\",\\"tag\\":\\"FAWSETa5y0fHmg8FxNP7LnUSFmK1klNCzgCS17SbK6A\\\\u003d\\"}"}',
  };

  try {
    const { addPaymentToOrder } = await shopClient.query(ADD_PAYMENT_TO_ORDER, {
      input: {
        method: 'accept-blue',
        metadata,
        // metadata: { paymentMethodId: 14556 }, // Use a saved payment method
      },
    });
    console.log(JSON.stringify);
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
