# Vendure MyParcel Plugin

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-myparcel)

Plugin for sending placed orders to MyParcel.

## Getting started

1. Add this to your plugins in `vendure-config.ts`:

```ts
import { MyparcelPlugin } from 'vendure-plugin-myparcel';

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
import { MyparcelPlugin } from 'vendure-plugin-myparcel';

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
