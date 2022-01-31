# Goedgepickt plugin

Plugin for integration with Goedgepickt. This plugin adheres to these principles:

- Vendure is your catalog. If you want a new product, add it in Vendure and this plugin will push it to Goedgepickt
- Goedgepickt manages all things stock related. StockLevel, size and weight are all managed by Goedgepickt and are
  leading.

## Plugin setup

//TODO steps

## How this plugin works

### Credentials

Add your `apiKey` and `webshopUuid` via the admin UI. When you save your credentials, the plugin will also set the
webhook in Goedgepickt.

### Product sync

This is a manual action. Via the Admin UI you can trigger a full sync. A full sync pushes all products in Vendure to
Goedgepickt, including images, titles and description. Products are matched by SKU.

The plugin will also pushe products to Goedgepickt on ProductEvents.

Full sync also pulls stocklevels from Goedgepickt.

### Order fulfillment

This plugin will push orders to Goedgepickt on fulfillment. Goedgepickt calls a webhook that will update the order
status in Vendure

### Stocklevels

Stocklevels are updated by one of the following triggers:

1. Every startup all productlevels are pulled from Goedgepickt
2. Full sync via UI also pulls all stocklevels from Goedgepickt
3. Goedgepickt calls a webhook when stocklevels change, this will also update stocklevel for a specific variant in
   Vendure
