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
           EBoekhoudenPlugin.init({
              vendureHost: tunnel.url,
              setWebhook: true // set webhooks in Goedgepickt or not
           }),
   ...
]
```

### Database migration

Run a database migration to add the GoedgepicktConfig entity to your database. It is used to store apiKeys and
webshopUuid's per channel.
https://www.vendure.io/docs/developer-guide/migrations/

### Admin UI

Add this plugin to your Admin UI and compile.

```js
compileUiExtensions({
   outputPath: path.join(__dirname, '__admin-ui'),
   extensions: [
      ...
              EBoekhoudenPlugin.ui,
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

## How this plugin works

### Full sync

This is a manual action. Via the Admin UI you can trigger a full sync. A full sync:

1. Pushes all products in Vendure to GoedGepickt. Products are matched by SKU.
2. Pulls stocklevels from GoedGepickt and updates in Vendure.
3. Sets/verifies webhook set on GoedGepickt account

### Order fulfillment

This plugin will push orders to GoedGepickt on order fulfillment by Vendure. GoedGepickt calls a webhook that will
update the order status in Vendure.

### Stocklevels

Stocklevels are updated in Vendure:

1. On every startup all productlevels are pulled from GoedGepickt. This is done via the jobQueue.
2. Via full sync via UI also pulls all stocklevels from GoedGepickt. This is synchronous in the mainprocess, so we can
   provide feedback to the user.
3. Via stockUpdate per variant webhook from GoedGepickt.

![UI screenshot](./docs/img.png)

[![Pinelab.studio logo](https://pinelab.studio/img/pinelab-logo.png)](https://pinelab.studio)
