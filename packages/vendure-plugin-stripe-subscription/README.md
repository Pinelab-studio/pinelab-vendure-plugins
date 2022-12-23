# Vendure Stripe Subscription plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-stripe-subscription/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-stripe-subscription)

This plugin allows you to sell subscription based services or memberships through Vendure.

!! This plugin currently only supports checkout of 1 single "Paid-in-full" subscription per order.

## Getting started

1. Go to Stripe > developers > webhooks and create a webhook to `https://your-vendure.io/stripe-subscriptions/webhook` (
   Use something liek localtunnel or ngrok for local development)
2. Select all `SetupIntent` events for the webhook.
3. Add the plugin to your `vendure-config.ts` plugins:

```ts
plugins: [StripeSubscriptionPlugin];
```

2. Start the Vendure server and login to the admin UI
3. Create a variant and select a `Subscription schedule` via the admin UI
4. The price of the variant should be the **price per billing interval**. I.E. for a subscription of $50 per 1 month,
   the variant price should be $50. For a subscription of $300 per 6 months, the variant price should be set to $300.
5. Create a payment method with the code `stripe-subscription-payment` and select `stripe-subscription` as handler.
6. Set your API key
7. Get the webhook secret from you Stripe dashboard and save it here.
8. The `label` fields are optional, used for displaying on the hosted Stripe checkout.
9. Save the payment method.

## Storefront usage

1. From your storefront, add the created variant to your order
2. Add a shippingaddress and a shippingmethod to the order (mandatory).
3. Call the graphql mutation `createStripeSubscriptionIntent` to receive the Setup intent.
4. Have the customer fill out his payment details.
5. Vendure will create the subscriptions after the intent has successfully been completed by the customer.
6. The order will be settled by Vendure when the subscriptions are created.

It's important to inform your customers what you will be billing in the
future: https://stripe.com/docs/payments/setup-intents#mandates

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

### Contributing and dev server

You can locally test this plugin by checking out the source.

1. Create a .env file with the following contents:

```
STRIPE_APIKEY=sk_test_
STRIPE_PUBLISHABLE_KEY=pk_test_
```

2. Run `yarn start`
3. Go to `http://localhost:3050/checkout` to view the Stripe checkout
