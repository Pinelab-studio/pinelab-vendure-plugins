# Vendure SendCloud plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-sendcloud/dev/@vendure/core)

This plugins creates orders in SendCloud as soon as a Vendure Order transitions to `PaymentSettled`.
The plugin uses `product.customFields.weight` to sync weight to SendCloud. It will divide the weight by 1000, because Sendcloud expects kilograms instead of grams.
If you don't have this field, no problem, a weight of `0` will be synced to SendCloud.

Add this to your `vendure-config.ts` to get the plugin up and running:

```js
Plugins: [
  SendcloudPlugin.init({
     publicKey: process.env.SENDCLOUD_API_PUBLIC,
     secret: process.env.SENDCLOUD_API_SECRET
  }),
  ...
]
```

You need both your SendCloud public key and secret key.

If you want orders to be updated in Vendure, set up a webhook in your SendCloud account pointing to `https://your-vendure-domain.io/sendcloud/webhook`

**This plugin autofulfills orders when the SendCloud handler is set for the shippingmethod**
The whole order is automatically fulfilled when it is placed (OrderPlacedEvent) and sent to Sendcloud.

## Additional parcel input

// TODO
