import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  ADD_ITEM_TO_ORDER,
  CREATE_PAYMENT_LINK,
  CREATE_PAYMENT_METHOD,
  setShipping,
} from './helpers';

import { StripeSubscriptionPlugin } from '../src/stripe-subscription.plugin';
// import { StripeSubscriptionPlugin } from 'vendure-plugin-stripe-subscription';

/**
 * Use something like NGROK to start a reverse tunnel to receive webhooks:  ngrok http 3050
 * Set the generated url as webhook endpoint in your Stripe account: https://8837-85-145-210-58.eu.ngrok.io/stripe-subscriptions/webhook
 * Make sure it listens for all checkout events. This can be configured in Stripe when setting the webhook
 * Now, you are ready to `yarn start`
 * The logs will display a link that can be used to subscribe via Stripe
 */
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
    plugins: [
      StripeSubscriptionPlugin,
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
      ...require('../../test/src/initial-data').initialData,
      shippingMethods: [{ name: 'Standard Shipping', price: 0 }],
    },
    productsCsvPath: `${__dirname}/subscriptions.csv`,
  });
  // Create stripe payment method
  await adminClient.asSuperAdmin();
  await adminClient.query(CREATE_PAYMENT_METHOD, {
    input: {
      code: 'stripe-subscription-method',
      name: 'Stripe test payment',
      description: 'This is a Stripe payment method',
      enabled: true,
      handler: {
        code: 'stripe-subscription',
        arguments: [
          {
            name: 'redirectUrl',
            value: `https://example.com/`,
          },
          { name: 'apiKey', value: process.env.STRIPE_APIKEY! },
        ],
      },
    },
  });
  console.log(`Created paymentMethod stripe-subscription`);
  // Prepare order
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  const { addItemToOrder: order } = await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: '1',
    quantity: 1,
  });
  await setShipping(shopClient);
  console.log(`Prepared order ${order.code}`);
  const { createStripeSubscriptionCheckout: link } = await shopClient.query(
    CREATE_PAYMENT_LINK,
    { code: 'stripe-subscription-method' }
  );
  console.log(`Payment link for order ${order.code}: ${link}`);
})();
