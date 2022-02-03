# Goedgepickt plugin

Plugin for integration with Goedgepickt. This plugin adheres to these principles:

- Vendure is your catalog. If you want a new product, add it in Vendure and this plugin will push it to Goedgepickt
- Goedgepickt manages all things stock related. StockLevel, size and weight are all managed by Goedgepickt and are
  leading.

## Plugin setup

### Vendure config

// TODO

### Admin UI

You can configure the plugin settings per channel via the Vendure Admin UI via Settings > Goedgepickt. The button `test`
calls the API with the filled in credentials to verify if the credentials are correct.

When you save the plugin will make sure the configured verndureHost is set as webhook for order and stock updates. **The
plugin will never delete webhooks**, so if you ever change your url, you should manually delete the old webhook via Goedgepickt.

## How this plugin works

### Credentials

Add your `apiKey` and `webshopUuid` via the admin UI. When you save your credentials, the plugin will also set the
webhook in Goedgepickt.

### Product sync

This is a manual action. Via the Admin UI you can trigger a full sync. A full sync pushes all products in Vendure to
Goedgepickt, including images, titles and description. Products are matched by SKU.

Full sync also pulls stocklevels from Goedgepickt and updates in Vendure.

### Order fulfillment

This plugin will push orders to Goedgepickt on fulfillment. Goedgepickt calls a webhook that will update the order
status in Vendure

### Stocklevels

Stocklevels are updated by one of the following triggers:

1. Every startup all productlevels are pulled from Goedgepickt. This is done via the jobQueue.
2. Full sync via UI also pulls all stocklevels from Goedgepickt. This is synchronous in the mainprocess, so we can
   provide feedback to the user.
3. Goedgepickt calls a webhook when stocklevels change, this will also update stocklevels for the given variant in
   Vendure.

![UI screenshot](./docs/img.png)

[![Pinelab.studio logo](https://pinelab.studio/img/pinelab-logo.png)](https://pinelab.studio)
