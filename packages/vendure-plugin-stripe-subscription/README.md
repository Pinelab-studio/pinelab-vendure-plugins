# Vendure Stripe Subscription plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-stripe-subscription/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-stripe-subscription)

This plugin allows you to sell subscription based services or memberships through Vendure.

- A Vendure product is a membership
- A membership has a duration
- A membership has a fixed start date, I.E. every 1st of the month
- A membership can be paid with a single payment
- A membership can be paid on a monthly basis
- Vendure orders are transitioned to `PaymentSettled` when a user has paid the full amount, or when the user
  subscribed (subscription created in Stripe)

## Getting started

1. Add the plugin to your `vendure-config.ts`

```ts
// TODO
```
