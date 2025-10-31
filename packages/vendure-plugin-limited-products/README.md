# Vendure Limited Products Plugin

### [Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-limit-product-per-order)

This plugin allows you to:

1. Limit the amount of a specific product per order. I.E. A customer is only allowed to
   buy 1 of product "Limited art t-shirt X" per order.
2. Only allow a product to be purchased in multiples of X. E.g. only per 4 items.

## Getting started

1. Add the following config to your `vendure-config.ts`:

```ts
import { LimitedProductsPlugin } from "@pinelab/vendure-plugin-limited-products"

plugins: [
   LimitedProductsPlugin,
   AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [
         // Include the admin UI extensions of this plugin
         LimitedProductsPlugin.uiExtensions
      ],
   }),
];

```

2. Run a database migration to add the custom fields.
3. Start Vendure, login and go to the product you want to limit.
4. Set the custom field `Maximum amount per order` and `Multiple of per order` on a variant and update the product
5. Customers can now only buy X amount of the variant per order. The same customer can still order the product again in
   a new order.

You can fetch `product.limitPurchasePerMultipleOf` and `product.maxQuantityPerOrder` via the Shop API to display messages on your storefront accordingly.

## Migrating to V3.x

V3 removes the fields from the variant and places them on a Product, in a different format. This plugin isn't used much, so there is no migration script available. We do it manually:

1. Back up all values of the variants before installing the plugin.
2. Install V4 of this plugin, and run a database migration.
3. Start the server and set the values on the parent products via the Admin UI
