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
2. On incoming webhook from Picqer
3. Or, on trigger of the GET endpoint `/picqer/pull-stock-levels/<channeltoken>`.

This plugin will mirror the stock locations from Picqer. Non-Picqer stock locations will automatically be deleted by the plugin, to keep stock in sync with Picqer. Vendure's internal allocated stock will be ignored, because this is handled by Picqer.

You can use a custom [StockLocationStrategy](https://github.com/vendure-ecommerce/vendure/blob/major/packages/core/src/config/catalog/default-stock-location-strategy.ts) to control how available stock is calculated based on multiple locations.

### Periodical stock level sync

You can call the endpoint `/picqer/pull-stock-levels/<channeltoken>`, with your Picqer API key as bearer token, to trigger a full stock level sync. This will pull stock levels from Picqer, and update them in Picqer.

```
curl -H "Authorization: Bearer abcde-your-apikey" `http://localhost:3000/picqer/pull-stock-levels/your-channel-token`
```

### Custom fulfillment process

This plugin installs a custom fulfillment process in your Vendure instance, because Picqer will be responsible for fulfilling and thus for allocating/releasing stock. The custom fulfillment process makes sure an order is always fulfillable, stock synchronization with Picqer handles the stock levels.

![!image](https://www.plantuml.com/plantuml/png/VOt1IeP054RtynJV0rIeAn4C9OXs2L7xmRdIq7McPkuiUlkqKVW5SNUvd7E-BeeEacPMJsp92UuVyK7Ef40DUcCW7XMiq1pNqmT3GMt0WVtK4MM1A7xyWf-oSXOTz2-qCuWamdHHx9dzg8Ns_IR7NztBehTbSGUz4QQjJWlFYIVBd3UkzS6EFnGEzjkA8tsR1S4KYFuVRVs0z_opReUXuw5UtyOBrQtKp4hz0G00)

- Without incoming stock from Picqer, items would be allocated indefinitely. Picqer has to tell Vendure what the stock levels of items are.

## Orders

1. Orders are pushed to Picqer with status `processing` when an order is placed in Vendure.
2. The order is immediately fulfilled on order placement.
3. On incoming `order.completed` event from Picqer, the order is transitioned to `Shipped`.
4. There currently is no way of telling when an order is `Deliverd` based on Picqer events, so we automatically transition to `Delivered`.

## Caveats

- Due to limitation of the Picqer API, the plugin only uploads images if no images exist for the product in Picqer.
- Stock is updated directly on a variant, so no `StockMovementEvents` are emitted by Vendure when variants are updated in Vendure by the full sync.
- This plugin automatically creates webhooks and deactivates old ones. Webhooks are created when you save your config.
