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
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import {
  StripeSubscriptionPlugin,
  StripeSubscriptionIntent,
  DefaultSubscriptionStrategy,
} from '../src/';
import {
  ADD_ITEM_TO_ORDER,
  CREATE_PAYMENT_LINK,
  CREATE_PAYMENT_METHOD,
  setShipping,
  UPDATE_CHANNEL,
} from './helpers';
import { StripeTestCheckoutPlugin } from './stripe-test-checkout.plugin';
import path from 'path';
import { DownPaymentSubscriptionStrategy } from './downpayment-subscription-strategy';

export let intent: StripeSubscriptionIntent;

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
      StripeTestCheckoutPlugin,
      StripeSubscriptionPlugin.init({
        vendureHost: process.env.VENDURE_HOST!,
        subscriptionStrategy: new DownPaymentSubscriptionStrategy(),
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: process.env.COMPILE_ADMIN
          ? compileUiExtensions({
              outputPath: path.join(__dirname, '__admin-ui'),
              extensions: [StripeSubscriptionPlugin.ui],
              devMode: true,
            })
          : undefined,
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
  // Set channel prices to include tax
  await adminClient.asSuperAdmin();
  const {
    updateChannel: { id },
  } = await adminClient.query(UPDATE_CHANNEL, {
    input: {
      id: 'T_1',
      pricesIncludeTax: true,
    },
  });
  console.log('Update channel prices to include tax');
  // Create stripe payment method
  await adminClient.asSuperAdmin();
  await adminClient.query(CREATE_PAYMENT_METHOD, {
    input: {
      code: 'stripe-subscription-method',
      enabled: true,
      handler: {
        code: 'stripe-subscription',
        arguments: [
          {
            name: 'webhookSecret',
            value: process.env.STRIPE_WEBHOOK_SECRET,
          },
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

  const { createStripeSubscriptionIntent } = await shopClient.query(
    CREATE_PAYMENT_LINK
  );
  intent = createStripeSubscriptionIntent;
  console.log(
    `Go to http://localhost:3050/checkout/ to test your ${intent.intentType}`
  );

  // Uncomment these lines to list all subscriptions created in Stripe
  // const ctx = await server.app.get(RequestContextService).create({apiType: 'admin'});
  // const subscriptions = await server.app.get(StripeSubscriptionService).getAllSubscriptions(ctx);
  // console.log(JSON.stringify(subscriptions));
})();
