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
import {PicqerPlugin} from '@pinelab/vendure-plugin-picqer'

...
plugins: [
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
2. Or, on incoming webhook from Picqer

This plugin will mirror the stock locations from Picqer. Non-Picqer stock locations will automatically be deleted by the plugin, to keep stock in sync with Picqer. Vendure's internal allocated stock will be ignored, because this is handled by Picqer.

You can use a custom [StockLocationStrategy](https://github.com/vendure-ecommerce/vendure/blob/major/packages/core/src/config/catalog/default-stock-location-strategy.ts) to control how available stock is calculated based on multiple locations.

## Orders

1. Orders are pushed to Picqer with status `processing` when an order is placed in Vendure. The Vendure order will remain in `Payment Settled` and no fulfillments are created.
2. Products are fulfilled in Vendure based on the products in the incoming `picklist.closed` events from Picqer. This can result in the order being `Shipped` or `PartiallyShipped`
3. Currently, when the order is `Shipped` it will automatically transition to `Delivered`, because we do not receive delivery events from Picqer.

### Order flow:

![Order flow](https://www.plantuml.com/plantuml/png/RSvD2W8n30NWVKyHkjS3p49c8MuT4DmFxLCBwOzfwlcbM45XTW_oyYLprLMqHJPN9Dy4j3lG4jmJGXCjhJueYuTGJYCKNXqYalvkVED4fyQtmFmfRw8NA6acMoGxr1hItPen_9FENQXxbsDXAFpclQwDnxfv18SN1DwQkLSYlm40)

[edit](https://www.plantuml.com/plantuml/uml/bOwn2i9038RtFaNef8E27Jj81n-W8BWVTr4FqqjDSe9lxnLQK73GBI7_z_tfr9nO7gWwOGfP43PxwAE_eq0BVTOhi8IoS9g7aPp70PF1ge5HE6HlklwA7z706EgIygWQqwMkvcE9BKGx0JUAQbjFh1ZWpBAOORUOFv6Ydl-P2ded5XtH4mv8yO62uV-cvfUcDtytHGPw0G00)

## Caveats

- Due to limitation of the Picqer API, the plugin only uploads images if no images exist for the product in Picqer.
- Stock is updated directly on a variant, so no `StockMovementEvents` are emitted by Vendure when variants are updated in Vendure by the full sync.
- This plugin automatically creates webhooks and deactivates old ones. Webhooks are created when you save your config.
