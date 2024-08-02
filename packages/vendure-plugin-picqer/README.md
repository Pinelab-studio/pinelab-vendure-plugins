# Vendure Picqer Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-picqer)

Vendure plugin to sync orders, stock and catalogue with Picqer.com order pick platform.

- Sync placed orders to Picqer
- Sync all products to Picqer
- Pull stock levels from Picqer into Vendure

The plugin follows these principles:

- Vendure should be considered the source of truth for product presentation: Assets, descriptions and names are pushed from Vendure to Picqer
- Picqer should be considered the source of truth for stock levels: Stock levels are pulled from Picqer into Vendure

## Getting started

Add the plugin to your `vendure-config.ts`

```ts
import { PicqerPlugin } from '@pinelab/vendure-plugin-picqer';
import { configureDefaultOrderProcess } from '@vendure/core';

...
// Make sure Picqer can transition to 'Delivered' without the need of fulfillment
orderOptions: {
  process: [
    configureDefaultOrderProcess({ checkFulfillmentStates: false })
  ]
},
plugins: [
  // Add Picqer as plugin
  PicqerPlugin.init({
          enabled: true,
          vendureHost: 'https://example-vendure.io',
          pushProductVariantFields: (variant) => ({ barcode: variant.sku }),
          pullPicqerProductFields: (picqerProd) => ({
            outOfStockThreshold: picqerProd.stockThreshold,
          }),
          pushPicqerOrderFields: (order) => ({
            customer_remarks: order.customFields.customerNote,
            pickup_point_data: {
              carrier: 'dhl',
              id: '901892834',
            },
          }),
          shouldSyncOnProductVariantCustomFields: ['productVariantCustomField']
        }),
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [
        PicqerPlugin.ui,
        ... // your other plugin UI extensions
      ],
    }),
  }),
... // your other plugins
]

```

Start the server and set the fulfillment handler to `picqer: Fulfill with Picqer` for all shipping methods that should be handled via Picqer.

## Stock levels

Stock levels are updated in Vendure on

1. Full sync via the Admin UI
2. Or, on trigger of the GET endpoint `/picqer/pull-stock-levels/<channeltoken>`.
3. On incoming webhook from Picqer. Before incoming webhooks work, you need a full sync or pull-stock-levels sync, so that stock locations are created in Vendure based on the Picqer Warehouses

This plugin will mirror the stock locations from Picqer. Non-Picqer stock locations will automatically be deleted by the plugin, to keep stock in sync with Picqer. Vendure's internal allocated stock will be ignored, because this is handled by Picqer.

You can use a custom [StockLocationStrategy](https://github.com/vendure-ecommerce/vendure/blob/major/packages/core/src/config/catalog/default-stock-location-strategy.ts) to control how available stock is calculated based on multiple locations.

### Periodical stock level sync

You can call the endpoint `/picqer/pull-stock-levels/<channeltoken>`, with your Picqer API key as bearer token, to trigger a full stock level sync. This will pull stock levels from Picqer, and update them in Vendure.

```
curl -H "Authorization: Bearer abcde-your-apikey" `http://localhost:3000/picqer/pull-stock-levels/your-channel-token`
```

### Order process override

This plugin requires the default order process to be configured with `checkFulfillmentStates: false`, so that orders can be transitioned to Shipped and Delivered without the need of fulfillment. Fulfillment is the responsibility of Picqer, so we won't handle that in Vendure when using this plugin.

![!image](https://www.plantuml.com/plantuml/png/VOv1IyD048Nl-HNl1rH9Uog1I8iNRnQYtfVCn0nkPkFk1F7VIvgjfb2yBM_VVEyx97FHfi4NZrvO3NSFU6EbANA58n4iO0Sn7jBy394u5hbmrUrTmhP4ij1-87JBoIteoNt3AI6ncUT_Y4VlG-kCB_lL0d_M9wTKRyiDN6vGlLiJJj9-SgpGiDB2XuMSuaki3vEXctmdVc2r8l-ijvjv2TD8ytuNcSz1lR_7wvA9NifmwKfil_OgRy5VejCa9a7_x9fUnf5fy-lNHdOc-fv5pwQfECoCmVy0)

- Without incoming stock from Picqer, either via webhook or pulled from the Picqer API, items would be allocated indefinitely. Picqer has to tell Vendure what the stock level of products are.

## Orders

1. Orders are pushed to Picqer with status `processing` when an order is placed in Vendure.
2. On incoming `order.completed` event from Picqer, the order is transitioned to `Shipped`.
3. There currently is no way of telling when an order is `Delivered` based on Picqer events, so we automatically transition to `Delivered`.

## Caveats

- Due to limitation of the Picqer API, the plugin only uploads images if no images exist for the product in Picqer.
- This plugin automatically creates webhooks and deactivates old ones. Webhooks are created when you save your config.
