import { LanguageCode, VendureConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { StripeSubscriptionIntent } from '../src/';
import {
  ADD_ITEM_TO_ORDER,
  CREATE_SHOP_PAYMENT_LINK,
  CREATE_PAYMENT_METHOD,
  setShipping,
} from './helpers/graphql-helpers';
import { config } from './vendure-config';

export let intent: StripeSubscriptionIntent;

/**
 * Use something like NGROK to start a reverse tunnel to receive webhooks:  ngrok http 3050
 * Set the generated url as webhook endpoint in your Stripe account: https://8837-85-145-210-58.eu.ngrok.io/stripe-subscriptions/webhook
 * Make sure it listens for all checkout events. This can be configured in Stripe when setting the webhook
 * Now, you are ready to `yarn start`
 * The logs will display a link that can be used to subscribe via Stripe
 */
(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, shopClient, adminClient } = createTestEnvironment(
    config as Required<VendureConfig>
  );
  await server.init({
    initialData: {
      ...require('../../test/src/initial-data').initialData,
      shippingMethods: [{ name: 'Standard Shipping', price: 0 }],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
  // Create stripe payment method
  await adminClient.asSuperAdmin();
  await adminClient.query(CREATE_PAYMENT_METHOD, {
    input: {
      code: 'stripe-subscription-method',
      enabled: true,
      handler: {
        code: 'stripe-subscription',
        arguments: [
          { name: 'webhookSecret', value: '' },
          { name: 'apiKey', value: process.env.STRIPE_APIKEY },
          { name: 'publishableKey', value: process.env.STRIPE_PUBLISHABLE_KEY },
        ],
      },
      translations: [
        {
          languageCode: LanguageCode.en,
          name: 'Stripe test payment',
          description: 'This is a Stripe payment method',
        },
      ],
    },
  });
  console.log(`Created paymentMethod stripe-subscription`);

  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  let { addItemToOrder: order } = await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: '1',
    quantity: 1,
  });

  await setShipping(shopClient);
  console.log(`Prepared order ${order?.code}`);

  console.log(`Waiting 5 seconds for webhooks to be registered`);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const { createStripeSubscriptionIntent } = await shopClient.query(
    CREATE_SHOP_PAYMENT_LINK
  );
  intent = createStripeSubscriptionIntent;
  console.log(
    `Go to http://localhost:3050/checkout/ to test your ${intent.intentType}`
  );
})();
