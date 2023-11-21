# Vendure Coinbase plugin

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-coinbase)

Accept crypto payments via Coinbase Commerce in Vendure.

## Getting started

Add the plugin to your `vendure-config.ts`:

```ts
import { CoinbasePlugin } from "@pinelab/vendure-plugin-coinbase"


plugins: [
  CoinbasePlugin,
  ...
  ];
```

### 2. Set API key in Vendure

1. Start your server
2. Go to the Admin UI > Settings > Payment methods and add a payment method with handler `coinbase-payment-handler`
3. Set your Coinbase API key. You can find your API key at https://beta.commerce.coinbase.com/settings/security
4. Set your desired storefront redirectUrl, something like `https://storefront/order/`. Your customer will be redirected
   to this page + order code: `https://storefront/order/897HH7HG7`
5. Save the payment method

### 3. Set webhook in Coinbase

1. Go to https://beta.commerce.coinbase.com/settings/notifications
2. Add a new webhook with endpoint `https://<your-vendure-server>/payments/coinbase`

### 4. Storefront usage

You can now call the mutation `createCoinbasePaymentIntent` to get a redirectUrl to the Coinbase hosted checkout page.
You can redirect your customer to this URL, so your customer can continue making a payment on the Coinbase platform.
After payment the customer will be redirected to `https://storefront/order/897HH7HG7`

## Notes

- Orders are NOT transitioned to `PaymentSettled` directly after Coinbase redirects the customer to the confirmation page, because
  crypto transactions can take some time to confirm. You should notify your customer with a message that the order will be
  handled when their transaction is confirmed. This can take a few minutes.

- Refunds are not supported. If you want to refund a payment done via Coinbase you need to manually do so. This plugin will not do refunds via
  Coinbase.
