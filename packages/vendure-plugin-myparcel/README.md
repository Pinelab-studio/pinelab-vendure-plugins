# Vendure MyParcel Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-myparcel)

Plugin for sending placed orders to MyParcel.

## Getting started

1. Add this to your plugins in `vendure-config.ts`:

```ts
import { MyparcelPlugin } from '@pinelab/vendure-plugin-myparcel';

plugins: [
  MyparcelPlugin.init({
    vendureHost: 'https://your-vendure-host.io',
    syncWebhookOnStartup: true, // If you want to automatically set vendureHost as webhook on MyParcel account
  }),
  ...
]
```

2. Add `MyparcelPlugin.ui` to your AdminUiPlugin extensions:

```ts
import { MyparcelPlugin } from '@pinelab/vendure-plugin-myparcel';

plugins: [
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [MyparcelPlugin.ui],
    }),
  }),
];
```

Read more about Admin UI compilation in the Vendure
[docs](https://www.vendure.io/docs/plugins/extending-the-admin-ui/#compiling-as-a-deployment-step)

3. Start Vendure and go to `Settings` > `MyParcel` and fill in your MyParcel API key.
4. Create a shipmentMethod with `MyParcel fulfillment`.
5. Place an order and select the shippingMethod.
6. Go to the Admin UI and click on `fulfill`
7. Your shipment should be in your MyParcel account.

## Customs information for shipments outside the EU

MyParcel requires additional customs information for shipments outside the EU. When you ship outside the EU, you should
implement the `getCustomsInformationFn` when initializing the plugin:

```ts
MyparcelPlugin.init({
  vendureHost: 'https://your-vendure-host.io',
  getCustomsInformationFn: (orderItem) => {
    return {
      weightInGrams: (orderItem.line.productVariant.product.customFields as any)
        .weight,
      classification: (
        orderItem.line.productVariant.product.customFields as any
      ).hsCode,
      countryCodeOfOrigin: 'NL',
    };
  },
});
```

You can find more information about the classification codes [here](https://myparcelnl.github.io/api/#7_E).

## Custom shipment strategy

If you want more control over the data that is send over to MyParcel, then you can implement a custom `shipmentStrategy`.

The shipment strategy needs to implement `MyParcelShipmentStrategy` and should containt the `getShipment` method. This method returns the shipment object for MyParcel [API reference](https://developer.myparcel.nl/api-reference/06.shipments.html)

If you only need to change the recipient or the options, you can extend the `MyParcalDefaultShipmentStrategy` and overwrite the method you need.

- `getOptions`
- `getRecipient`

```ts
class CustomShipmentStrategy extends MyParcalDefaultShipmentStrategy {
  getShipment(address: OrderAddress, order: Order, customsContent: string) {
    const shipment: MyparcelShipment = {
      carrier: 2, //bpost. Only available on sendmyparcel.be
      reference_identifier: order.code,
      options: this.getOptions(address, order, customsContent),
      recipient: this.getRecipient(address, order, customsContent),
    };

    return shipment;
  }
}
```

Pass you strategy to the MyparcelPlugin config.

```ts
MyparcelPlugin.init({
  vendureHost: 'https://your-vendure-host.io',
  shipmentStrategy: new CustomShipmentStrategy(),
});
```

`getCustomsInformationFn` will still be processed after the custom shipment strategy
