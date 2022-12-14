# Vendure Stripe Subscription plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-stripe-subscription/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-stripe-subscription)

This plugin allows you to sell subscription based services or memberships through Vendure.

## Getting started

1. Add the plugin to your `vendure-config.ts`

```ts
// TODO
```

## How subscriptions work

// TODO describe concepts

- A Vendure product variant is a membership
- A membership can have a duration. When duration is 0, the membership is indefinite.
- A membership has a fixed start date, I.E. every 1st of the month
- A membership can be paid with a single payment or paid on a monthly basis. This is decided based on the variant
  picked.
- Only memberships with the same payment frequency + one time payment can be paid in a single order: A monthly
  subscription and a one-time-payment can be checked out in the same order, but a Monthly and a Weekly subscription can
  not be in the same order. This is due to a limitation in Stripe.
- Customers are redirected to the one time orders are transitioned to `PaymentSettled` when a customer has completed the Stripe checkout successfully.
  For one time payments this means everything is paid, for subscriptions this means only the initial amount has been
  paid and Stripe will handle future payments automatically.
- Payment frequency
- Startdate
- Proration
- Downpayment

### examples
