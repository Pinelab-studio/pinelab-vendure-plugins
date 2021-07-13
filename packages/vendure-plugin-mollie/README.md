# Channel aware payment provider for Mollie

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-mollie/dev/@vendure/core)  
This plugin is channel-aware, meaning you can have a different API key and redirect Url per channel.

### 1. Add in plugin list in `vendure-config.ts`:

```js
MolliePlugin.init('https://yourhost.io/');
```

Pass your publicly available Vendure host to the plugin.
This is used by Mollie to let the plugin know when the status of a payment changed.

**does not work with localhost** Use something like `localtunnel` to test locally.

### 2. Admin ui

1. Go to the Vendure admin
2. Go to `settings > paymentMethods` and create a payment method with the name `mollie-payment-YOUR_CHANNEL_TOKEN`.
   This specific name is used in the webhook from Mollie.
3. Set the `redirectUrl`, this is the url that is used to redirect the end-user. I.E. `https://storefront/`
4. Set the your Mollie key in the `apiKey` field.

**The redirect url is used like this: `${redirectUrl}order/${order.code}`, so your user will be directed to the page on `https://storefront/order/CH234X5`**
