![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-goedgepickt/dev/@vendure/core)

# Vendure GoedGepickt plugin

Plugin for integration with GoedGepickt. The seperation between Vendure and GoedGepickt is as follows:

- Vendure is your catalog. If you want a new product, add it in Vendure and synchronize via the Admin UI.
- GoedGepickt manages all things stock related. StockLevel, size and weight are all managed by GoedGepickt.

## Plugin setup

The plugin needs some static config in `vendure-config.ts` and dynamic per-channel config that can be set via the Admin
UI.

### Vendure config

Add this to your plugin in `vendure-config.ts`:

```js
plugins: [
  ...
    GoedgepicktPlugin.init({
      vendureHost: tunnel.url,
      endpointSecret: 'some-secret', // Used to validate incoming requests to /fullsync
      setWebhook: true // set webhooks in Goedgepickt or not
    }),
  ...
]
```

### Database migration

Run a database migration to add the new fields and entities to your database.
https://www.vendure.io/docs/developer-guide/migrations/

### Admin UI

Add this plugin to your Admin UI and compile.

```js
compileUiExtensions({
  outputPath: path.join(__dirname, '__admin-ui'),
  extensions: [
    ...
      GoedgepicktPlugin.ui,
    ...
  ]
```

Read more about Admin UI compilation in the Vendure
docs https://www.vendure.io/docs/plugins/extending-the-admin-ui/#compiling-as-a-deployment-step

### Credentials via Admin UI

You can configure your `apiKey` and `webshopUuid` per channel via the Vendure Admin UI via Settings > GoedGepickt. The
button `test`
calls the API with the filled in credentials to verify if the credentials are correct.

When you save the credentials, the plugin will make sure the configured vendureHost is set as webhook for order and
stock updates. **The plugin will never delete webhooks**, so if you ever change your url, you should manually delete the
old webhook via GoedGepickt.

### Cron sync via endpoint

Full sync can also be called via endpoint `/goedgepickt/full-sync/<webhook-secret>/`. You can use this to periodically
run the full sync. The endpoint does a sync for all channels with Goedgepickt plugin enabled.

1. Pushes all products in Vendure to GoedGepickt. Products are matched by SKU.
2. Pulls stocklevels from GoedGepickt and updates in Vendure.

This endpoint pushes a job to the worker, so receiving a status 200 doesn't necessarily mean the sync succeeded.

## Pickup points / drop off points

This plugin uses custom fields on an order as pickup location address. You can set a pickup points on an order with this
mutation, the plugin will then send the address to Goedgepickt:

```graphql
mutation {
  setOrderCustomFields(
    input: {
      customFields: {
        pickupLocationNumber: "1234"
        pickupLocationCarrier: "1"
        pickupLocationName: "Local shop"
        pickupLocationStreet: "Shopstreet"
        pickupLocationHouseNumber: "13"
        pickupLocationZipcode: "8888HG"
        pickupLocationCity: "Leeuwarden"
        pickupLocationCountry: "nl"
      }
    }
  ) {
    ... on Order {
      id
      code
    }
    ... on NoActiveOrderError {
      errorCode
      message
    }
  }
}
```

## How this plugin works

### Run full sync via Admin UI

This is a manual action. Via the Admin UI you can trigger a full sync. A full sync:

1. Pushes all products in Vendure to GoedGepickt. Products are matched by SKU.
2. Pulls stocklevels from GoedGepickt and updates in Vendure.
3. Sets/verifies webhook set on GoedGepickt account

This action is synchronous, so the Admin UI will provide you feedback if the action succeeded or not.

### Order fulfillment

This plugin will push orders to GoedGepickt on order fulfillment by Vendure. GoedGepickt calls a webhook that will
update the order status in Vendure.

### Stocklevels

Stocklevels are updated in Vendure:

1. Via full sync via UI also pulls all stocklevels from GoedGepickt. This is synchronous in the mainprocess, so we can
   provide feedback to the user.
2. Via stockUpdate per variant webhook from GoedGepickt.

![UI screenshot](./docs/img.png)

## Enjoying our plugins?

Enjoy the Pinelab Vendure plugins? [Consider becoming a sponsor](https://github.com/sponsors/Pinelab-studio).

Or check out [pinelab.studio](https://pinelab.studio) for more articles about our integrations.
<br/>
<br/>
<br/>
[![Pinelab.studio logo](https://pinelab.studio/assets/img/favicon.png)](https://pinelab.studio)
