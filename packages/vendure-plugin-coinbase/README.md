# Vendure Coinbase plugin

Accept crypto payments via the Coinbase platform in Vendure.

## Getting started

Add the plugin to your `vendure-config.ts`:

```ts
plugins: [CoinbasePlugin];
```

1. Start your server
2. Go to the Admin UI > Settings > Payment methods and add a payment method
3. Fill in your Coinbase ApiKey
4. Fill in your Coinbase shared secret
5. Fill in your desired storefront redirectUrl
6. Save the payment method

### Storefront

You can now call the mutation `createCoinbasePaymentIntent` to get a redirectUrl to the Coinbase hosted checkout page.

## Refunds not supported

If you want to refund a payment done via Coinbase you need to manually do so.
This plugin will not do refunds via Coinbase.
