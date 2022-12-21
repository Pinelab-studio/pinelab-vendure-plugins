# Vendure Stripe Subscription plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-stripe-subscription/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-stripe-subscription)

This plugin allows you to sell subscription based services or memberships through Vendure.

!! This plugin currently only supports checkout of 1 single "Paid-in-full" subscription per order.

## Getting started

1. Go to Stripe > developers > webhooks and create a webhook to `https://your-vendure.io/stripe-subscriptions/webhook` (Use something liek localtunnel or ngrok for local development)
2. Select all `Checkout` and `PaymentIntent` events for the webhook.
3. Add the plugin to your `vendure-config.ts` plugins:

```ts
plugins: [StripeSubscriptionPlugin];
```

2. Start the Vendure server and login to the admin UI
3. Create a variant with the following custom fields:

```js
  subscriptionDownpayment: 0, // or empty
  durationInterval: 'month',
  durationCount: 6,
  startDate: 'Start of the billing interval',
  billingInterval: 'month',
  billingType: 'Paid in full'
```

4. Create a payment method with the code `stripe-subscription-payment` and select `stripe-subscription` as handler.
5. Set your API key
6. Set a redirect url. This is used to redirect your customer back to your storefront from the Stripe platform.
7. The `label` fields are optional, used for displaying on the hosted Stripe checkout.
8. Save the payment method.

## Storefront usage

1. From your storefront, add the created variant to your order
2. Add a shippingaddress and a shippingmethod to the order
3. Call the mutation `createStripeSubscriptionCheckout('stripe-subscription-payment')` to receive an url to the hosted Stripe checkout page.
4. Redirect your customer to the url.
5. The order will be settled when a customer completes the checkout.

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
    proratedDays
    recurringPrice
    interval
    intervalCount
  }
}
```

`Downpayment` and `startDate` are optional parameters. Without them, the subscriptions default will be used.
