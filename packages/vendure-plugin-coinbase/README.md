# Vendure Coinbase plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-coinbase/dev/@vendure/core)

Accept crypto payments via Coinbase Commerce in Vendure.

**Orders are NOT transitioned to `PaymentSettled` when Coinbase redirects the customer to the confirmation page. You
should notify your customer with a message that the order will be handled when their transaction is confirmed**

**A payment can not be reversed by a customer, but can theoretically be rejected, but this is usually not the case. It's
your own responsibility to check for failed payments in Coinbase.**

## Getting started

You need to install the plugin, set API key in Vendure and set a webhook in your Coinbase account

### 1. Install the plugin in Vendure

Add the plugin to your `vendure-config.ts`:

```ts
plugins: [CoinbasePlugin];
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
After payment the customer will be redirected to `https://storefront/order/897HH7HG7`

## Refunds not supported

If you want to refund a payment done via Coinbase you need to manually do so. This plugin will not do refunds via
Coinbase.

## Webhook validation

This plugin does not use the sharedSecret to validate incoming webhooks, but instead calls the Coinbase API with the
given chargeId to validate the status on Coinbase.

## Contributing

Contributions always welcome!

### Dev server

Run `yarn start` to start the dev server. This logs will output a Coinbase hosted checkout URL you can use to do a
payment.

Use NGROK or localtunnel to make your localhost publicly available. Set the tunnel url as webhook in your Coinbase
account.

After paying you should see your order in the Admin UI on 'PaymentSettled'.

### Testing

Run `yarn test` to run e2e tests

[![Pinelab.studio logo](https://pinelab.studio/img/pinelab-logo.png)](https://pinelab.studio)
