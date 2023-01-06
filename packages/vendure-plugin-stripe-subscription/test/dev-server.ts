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
import { StripeTestCheckoutPlugin } from './stripe-test-checkout.plugin';
import {
  ADD_ITEM_TO_ORDER,
  CREATE_PAYMENT_LINK,
  CREATE_PAYMENT_METHOD,
  setShipping,
} from './helpers';

import { StripeSubscriptionPlugin } from '../src/stripe-subscription.plugin';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import * as path from 'path';
// import { StripeSubscriptionPlugin } from 'vendure-plugin-stripe-subscription';

export let clientSecret = 'test';

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
      StripeTestCheckoutPlugin,
      StripeSubscriptionPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        /*        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [StripeSubscriptionPlugin.ui],
          devMode: false
        }),*/
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
            name: 'webhookSecret',
            value: process.env.STRIPE_WEBHOOK_SECRET,
          },
          { name: 'apiKey', value: process.env.STRIPE_APIKEY },
        ],
      },
    },
  });
  console.log(`Created paymentMethod stripe-subscription`);
  // Prepare order
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);
  // Add paid in full
  let { addItemToOrder: order } = await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: '1',
    quantity: 1,
    customFields: {
      // downpayment: 40000,
      startDate: in3Days,
    },
  });
  // Add monthly sub
  /*  let { addItemToOrder: order } = await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: '2',
    quantity: 1,
    customFields: {
      downpayment: 40000,
      startDate: in3Days,
    },
  });*/
  await setShipping(shopClient);
  console.log(`Prepared order ${order.code}`);
  const { createStripeSubscriptionIntent: secret } = await shopClient.query(
    CREATE_PAYMENT_LINK
  );
  clientSecret = secret;
  console.log(`Go to http://localhost:3050/checkout/ to test your intent`);
})();
