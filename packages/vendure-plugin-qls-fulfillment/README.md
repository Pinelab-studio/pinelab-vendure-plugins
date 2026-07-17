# Vendure plugin to fulfill orders via QLS

Vendure plugin to fulfill orders via QLS. This uses QLS as fulfillment center and does not support shipments only via QLS.

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-qls-fulfillment)

This plugin contains:

## Product Sync

- Full product sync (via Admin UI):
  - Fetches all products from QLS
  - Ensures corresponding Vendure variants exist
  - Updates Vendure stock levels from QLS
- Partial product sync: Creates/updates products in QLS when products change in Vendure
- Partial stock sync: Updates Vendure stock based on incoming QLS webhooks

## Additional EANs

Additional EANs (or barcodes) are not automatically synced from Vendure to QLS. They can only be added manually via the `addAdditionalEANSToQLS` admin mutation. This mutation only adds EANs that do not already exist in QLS; existing EANs are skipped.

Removal of additional EANs is not supported by this plugin and must be done inside the QLS platform itself. QLS may have assigned stock to those barcodes, so removing them should be handled in QLS directly.

```graphql
mutation AddAdditionalEANSToQLS($variantId: ID!, $additionalEANS: [String!]!) {
  addAdditionalEANSToQLS(variantId: $variantId, additionalEANS: $additionalEANS)
}
```

The mutation returns the list of all existing EANs for the product in QLS after the operation. The variant must already have a `qlsProductId` stored in its custom fields (i.e. it must have been synced to QLS first), otherwise an error is thrown. After adding EANs, the mutation also triggers a sync of the variant to QLS to ensure product fields are up to date.

## Order Sync

- Pushes orders to QLS automatically on order placement
- Supports manual order push to QLS via Admin UI
- Updates order status in Vendure based on QLS webhooks

## Getting started

```ts
import { QlsPlugin } from '@pinelab/vendure-plugin-qls-fulfillment';

// In your VendureConfig:
plugins: [
  QlsPlugin.init({
    getConfig: (ctx) => {
      // Return config for the current channel, or undefined to disable QLS for this channel
      return {
        username: 'qls-username',
        password: 'qls-password',
        companyId: 'your-company-id',
        brandId: 'your-brand-id',
      };
    },
    webhookSecret: 'your-random-secret',
    productSync: {
      // Required: map Vendure variants to QLS product fields
      getAdditionalVariantFields: (ctx, variant) => ({
        ean: variant.sku,
        image_url: `https://your-cdn.com/${variant.featuredAsset?.preview}`,
      }),
      // Optional: exclude certain variants from being synced to QLS
      excludeVariantFromSync: (ctx, injector, variant) => {
        return variant.sku.startsWith('DONOTSYNC');
      },
    },
    orderSync: {
      // Optional: push additional fields to QLS when creating an order
      pushAdditionalOrderFields: (ctx, injector, order) => ({
        custom_values: [
          {
            key: 'vendureOrder',
            value: `https://your-admin.com/admin/orders/${order.code}`,
          },
        ],
      }),
      // Optional: delay order processing in QLS by 2 hours
      processOrderFrom: (ctx, order) => {
        return new Date(Date.now() + 1000 * 60 * 60 * 2);
      },
    },
  }),
];
```

This plugin requires the default order process to be configured with `checkFulfillmentStates: false`, so that orders can be transitioned to Shipped and Delivered without the need of fulfillment. Fulfillment is the responsibility of Picqer, so we won't handle that in Vendure when using this plugin.

## Webhooks

You should set up webhooks for the following events:

- `fulfillment_order.cancelled`
- `fulfillment_product.stock`
- `fulfillment_order.status`
- `fulfillment_order.completed`

The URL for all these events should be `https://<YOUR_VENDURE_HOST>/qls/webhook/<CHANNEL_TOKEN>?secret=<PLUGIN_SECRET>`. E.g. `https://example.com/qls/webhook/your-channel-token?secret=121231`.

- `<YOUR_VENDURE_HOST>` is the URL of your Vendure instance.
- `<CHANNEL_TOKEN>` is the token of the channel you want to use.
- `<PLUGIN_SECRET>` is the webhook secret you've passed into the plugin's `init()` function.

### Stock location setup

This plugin only uses Vendure's default stock location, that means you should either:

1. Remove all but one stock location in Vendure
2. Or, remove all stock from other stock locations than the default in Vendure

Vendure assumes the first created stock location is the default stock location.

## Service Points

You can use the query `qlsServicePoints(postalCode: String!): [QlsServicePoint!]!` to get the service points for a given postal code. You can use the `setOrderCustomFields` mutation to set the service point on an order.

```graphql
mutation {
  setOrderCustomFields(
    input: {
      customFields: {
        qlsServicePointId: "12232" # This is the ID of one of the points returned by the query above
        qlsServicePointDetails: "Some details about the service point for admin users" # This is just for admin users in Vendure
      }
    }
  ) {
    __typename
    ... on Order {
      id
      code
      customFields {
        qlsServicePointId
        qlsServicePointDetails
      }
    }
  }
}
```

## Monitoring failed orders and product syncs

Whenever an order fails to be pushed to QLS, an event is emitted. You can listen to this event to monitor failed orders.

```ts
this.eventBus.ofType(QlsOrderFailedEvent).subscribe((event) => {
  console.log('Order failed to be pushed to QLS:', event.order.code);
});
```

Because a job can be retried, this event can be emitted multiple times for the same order. You can use the date field together with the order code to determine if you have already processed this event.

```ts
this.eventBus.ofType(QlsOrderFailedEvent).subscribe((event) => {
  // Determine if we have already processed this event.
  const uniqueEventId = `${event.order.code}_${
    event.failedAt.toISOString().split('T')[0]
  }`; // "JHD82JS8868_2026-01-01"
  console.log('Order failed to be pushed to QLS:', event.order.code);
});
```

For product syncs, the same approach can be used, but with the `QlsProductSyncFailedEvent` instead.

## Manually pushing orders to QLS

This plugin adds a button `push to QLS` to the order detail page in the Admin UI. This will push the order to QLS again. If the order has been pushed before, you need to uncheck the checkbox `synced to QLS` in the order custom fields first.

Pushing an order to QLS again will not cancel the existing order in QLS. Cancel existing orders first via https://mijn.pakketdienstqls.nl/.
