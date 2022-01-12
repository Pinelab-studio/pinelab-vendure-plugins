# Goedgepickt plugin

Plugin for integration with Goedgepickt. This plugin adheres to these principles:

- Vendure manages most product information. If you want a new product, add it in Vendure and this plugin will push it to
  Goedgepickt
- Goedgepickt manages a products physical properties like size and weight.
- Goedgepickt manages stock. Stocklevels can change in Goedgepickt because stock can be shared among
  multiple webshops or even physical stores

## How this plugin works

- Push all products from Vendure to Goedgepickt on every startup (using Vendure Jobs)
- Syncs all stocklevels from Goedgepickt to Vendure on startup
- Vendure pushes products to Goedgepickt on Product events
- Vendure pushes orders to Goedgepickt on order fulfillment. Goedgepickt will handle the stock for us.
- Goedgepickt will update the order status in Vendure by incoming webhook

## Plugin setup

1. Create an ApiKey at https://account.goedgepickt.nl/settings/api
2. Create the following webhooks at https://account.goedgepickt.nl/settings/webhooks:
   1. `Bestelstatus aangepast`
   2. `Voorraad aangepast`
3. 

- Plugin uses a hardcoded a limit of 10000 variants per channel. Set `adminListQueryLimit: 10000,` in apiOptions config.

// TODO diagram of flow: order placed, order fulfillment, goedgepickt
