# Vendure Stripe Subscription plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-stripe-subscription/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-stripe-subscription)

This plugin allows you to sell subscription based services or memberships through Vendure. This plugin was made in
collaboration with the great people at [isoutfitters.com](https://isoutfitters.com/)

## Getting started

A few things you should know before getting started:

- Subscriptions are defined by `Schedules`. A schedule is a blueprint for a subscription and can be reused on multiple
  subscriptions. An example of a schedule is
  `Billed every first of the month, for 6 months`.
- Schedules have a fixed duration. They can be configured to auto-renew after that duration.
- By connecting a `Schedule` to a ProductVariant, you turn the variant into a subscription. The price of the variant is
  the price a customer pays **per interval**.

### Examples

A variant with price $30,- and schedule `Duration of 6 months, billed montly` is a subscription where the customer is
billed $30,- per month for 6 months. After which is auto-renews.

A variant with price $300 and a schedule of `Duration of 12 months, billed every 2 months` is a subscription where the
customer is billed $300 every 2 months, for a duration of 12 months. After which is auto-renews.

### Setup Stripe webhook

1. Go to Stripe > developers > webhooks and create a webhook to `https://your-vendure.io/stripe-subscriptions/webhook` (
   Use something like localtunnel or ngrok for local development)
2. Select `setup_intent.succeeded` as event for the webhook.

## Vendure setup

3. Add the plugin to your `vendure-config.ts` plugins and admin UI compilation:

```ts
import { StripeSubscriptionPlugin } from 'vendure-plugin-stripe-subscription';

plugins: [
  StripeSubscriptionPlugin,
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [StripeSubscriptionPlugin.ui],
    }),
  }),
];
```

5. Start the Vendure server and login to the admin UI
6. Go to `Settings > Subscriptions` and create a Schedule.
7. Create a variant and select a schedule in the variant detail screen in the admin UI.
8. Create a payment method with the code `stripe-subscription-payment` and select `stripe-subscription` as handler. **
   Your payment method MUST have 'stripe-subscription' in the code field**
9. Set your API key from Stripe.
10. Get the webhook secret from you Stripe dashboard and save it on the payment method.

## Storefront usage

1. From your storefront, add the created variant to your order
2. Add a shippingaddress and a shippingmethod to the order (mandatory for all orders).
3. Call the graphql mutation `createStripeSubscriptionIntent` to receive the Payment intent token.
4. Use this token to display the Stripe form on your storefront. See
   the [Stripe docs](https://stripe.com/docs/payments/accept-a-payment?platform=web&ui=elements#set-up-stripe.js) on how
   to accomplish that.
5. During the checkout the user is only charged any potential downpayment or proration (
   see [Advanced features](#advanced-features)). The recurring charges will occur on the start of the schedule.
6. Have the customer fill out his payment details.
7. Vendure will create the subscriptions after the intent has successfully been completed by the customer.
8. The order will be settled by Vendure when the subscriptions are created.

It's important to inform your customers what you will be billing them in the
future: https://stripe.com/docs/payments/setup-intents#mandates

# Advanced features

## Paid in full

// TODO. No downpayments! examples

## Prorations

All subscriptions have a fixed start moment, for example "Every first of the month". This is also when billing will
occur. If a customer orders a subscription now, but the subscription starts in 5 days, a prorated amount for the
remaining 5 days will be billed to the customer.

### Customer chosen start dates

// TODO

### Customer chosen downpayments

// TODO

### Preview pricing calculations

You can preview the pricing model of a subscription without adding it to cart with the following query on the shop-api:

```graphql
{
  getStripeSubscriptionPricing(
    input: {
      productVariantId: 1
      startDate: "2022-12-25T00:00:00.000Z"
      downpayment: 1200
    }
  ) {
    downpayment
    totalProratedAmount
    proratedDays
    recurringPrice
    interval
    intervalCount
    amountDueNow
  }
}
```

`Downpayment` and `startDate` are optional parameters. Without them, the subscriptions default will be used.

## Caveats

1. This plugin overrides any set OrderItemCalculationStrategies. The strategy in this plugin is used for calculating the
   amount due for a subscription, if the variant is a subscription. For non-subscription variants, the normal default
   orderline calculation is used. Only 1 strategy can be used per Vendure instance, so any other
   OrderItemCalculationStrategies are overwritten by this plugin.

### Contributing and dev server

You can locally test this plugin by checking out the source.

1. Create a .env file with the following contents:

```
STRIPE_APIKEY=sk_test_
STRIPE_PUBLISHABLE_KEY=pk_test_
```

2. Run `yarn start`
3. Go to `http://localhost:3050/checkout` to view the Stripe checkout
