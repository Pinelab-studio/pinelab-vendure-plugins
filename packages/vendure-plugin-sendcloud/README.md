# Vendure SendCloud plugin

### [Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-sendcloud)

This plugin syncs orders to the SendCloud fulfillment platform.

## Getting started

1. Add the plugin to your `vendure-config.ts`:

```ts
plugins: [
  SendcloudPlugin.init({}),
  ...
]
```

2. Add the SendCloud Ui to the Vendure admin:

```ts
AdminUiPlugin.init({
  port: 3002,
  route: 'admin',
  app: compileUiExtensions({
    outputPath: path.join(__dirname, '__admin-ui'),
    extensions: [SendcloudPlugin.ui],
  }),
}),
```

3. Run a DB [migration](https://www.vendure.io/docs/developer-guide/migrations/) to add the new SendCloudConfigEntity to
   the database.
4. Go to your SendCloud account and go to `Settings > Integrations` and create an integration.
5. Write down the `secret` and `publicKey` of the created integration
6. For the same integration, add the webhook `https://your-vendure-domain.io/sendcloud/webhook/your-channel-token`. This
   will update orders when the status changes in SendCloud.
7. Start Vendure and login as admin
8. Make sure you have the permission `SetSendCloudConfig`
9. Go to `Settings > SendCloud`
10. You can fill in your SendCloud `secret` and `public key` here and click save.
11. Additionally, you can set a fallback phone number, for when a customer hasn't filled out one. A phone number is
    required by Sendcloud in some cases.

Now, when an order is placed, it will be automatically fulfilled and send to SendCloud.

## Additional configuration

You can choose to send additional info to SendCloud: `weight`, `hsCode`, `origin_country` and additional parcel items.
Parcel items will show up as rows on your SendCloud packaging slips.

```ts
import 'SendCloudPlugin, getNrOfOrders';

from;
('vendure-plugin-sendcloud');
plugins: [
  SendcloudPlugin.init({
    /**
     * Implement the weightFn to determine the weight of a parcel item,
     * or set a default value
     */
    weightFn: (line) =>
      (line.productVariant.product?.customFields as any)?.weight || 5,
    /**
     * Implement the hsCodeFn to set the hsCode of a parcel item,
     * or set a default value
     */
    hsCodeFn: (line) =>
      (line.productVariant.product?.customFields as any)?.hsCode || 'test hs',
    /**
     * Implement the originCountryFn to set the origin_country of a parcel item,
     * or set a default value
     */
    originCountryFn: (line) => 'NL',
    /**
     * Implement the additionalParcelItemsFn to add additional rows to the SendCloud order.
     * This example adds the nr of previous orders of the current customer to SendCloud
     */
    additionalParcelItemsFn: async (ctx, injector, order) => {
      additionalInputs.push(await getNrOfOrders(ctx, injector, order));
      return additionalInputs;
    },
  }),
];
```
