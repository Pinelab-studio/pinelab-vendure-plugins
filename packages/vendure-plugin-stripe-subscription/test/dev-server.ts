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
  UPDATE_CHANNEL,
  UPDATE_VARIANT,
} from './helpers';

import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import * as path from 'path';
import { UPSERT_SCHEDULES } from '../src/ui/queries';
import { SubscriptionInterval, SubscriptionStartMoment } from '../src';

// Test published version
import { StripeSubscriptionPlugin } from '../src/stripe-subscription.plugin';
//  import { StripeSubscriptionPlugin } from 'vendure-plugin-stripe-subscription';

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
        app: process.env.COMPILE_ADMIN
          ? compileUiExtensions({
              outputPath: path.join(__dirname, '__admin-ui'),
              extensions: [StripeSubscriptionPlugin.ui],
              devMode: true,
            })
          : // otherwise used precompiled files. Might need to run once using devMode: false
            {
              path: path.join(__dirname, '__admin-ui/dist'),
            },
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
  await adminClient.query(UPSERT_SCHEDULES, {
    input: {
      name: '6 months, paid in full',
      downpaymentWithTax: 0,
      durationInterval: SubscriptionInterval.Month,
      durationCount: 6,
      startMoment: SubscriptionStartMoment.StartOfBillingInterval,
      billingInterval: SubscriptionInterval.Month,
      billingCount: 6,
    },
  });
  await adminClient.query(UPSERT_SCHEDULES, {
    input: {
      name: '3 months, billed monthly, 199 downpayment',
      downpaymentWithTax: 19900,
      durationInterval: SubscriptionInterval.Month,
      durationCount: 3,
      startMoment: SubscriptionStartMoment.StartOfBillingInterval,
      billingInterval: SubscriptionInterval.Week,
      billingCount: 1,
    },
  });
  const future = new Date('01-01-2024');
  await adminClient.query(UPSERT_SCHEDULES, {
    input: {
      name: 'Fixed start date, 6 months, billed monthly, 60 downpayment',
      downpaymentWithTax: 6000,
      durationInterval: SubscriptionInterval.Month,
      durationCount: 6,
      startMoment: SubscriptionStartMoment.FixedStartdate,
      billingInterval: SubscriptionInterval.Week,
      billingCount: 1,
      fixedStartDate: future,
    },
  });
  console.log(`Created subscription schedules`);
  await adminClient.query(UPDATE_VARIANT, {
    input: [
      {
        id: 1,
        customFields: {
          subscriptionScheduleId: 3,
        },
      },
    ],
  });
  await adminClient.query(UPDATE_VARIANT, {
    input: [
      {
        id: 2,
        customFields: {
          subscriptionScheduleId: 3,
        },
      },
    ],
  });
  console.log(`Added schedule to variants`);
  // Prepare order
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

  // This is the variant for checkout
  await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: '2',
    quantity: 1,
    customFields: {
      // downpayment: 40000,
      // startDate: in3Days,
    },
  });
  let { addItemToOrder: order } = await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: '1',
    quantity: 1,
    customFields: {
      // downpayment: 40000,
      // startDate: in3Days,
    },
  });
  await setShipping(shopClient);
  console.log(`Prepared order ${order?.code}`);
  const { createStripeSubscriptionIntent: secret } = await shopClient.query(
    CREATE_PAYMENT_LINK
  );
  clientSecret = secret;
  console.log(`Go to http://localhost:3050/checkout/ to test your intent`);
})();
