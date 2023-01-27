# Vendure Plugin for bulk updating all variant prices of a product

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-variant-price-bulk-update/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-variant-price-bulk-update)

This plugin allows you to update the prices of all variants for a given product with a single field on a Product. This
is especially useful for products with a lot of variants.

If `product.customFields.price` has a value, and a product is updated, all variants will also be updated. If you only
want to bulk update the variants once, you have to empty the `product.customFields.price` field again.

## Getting started

1. Add the following config to your `vendure-config.ts`:

```ts
plugins: [LimitVariantPerOrderPlugin];
```

2. Start Vendure, login and go to the product you want to limit.
3. Set the custom field `Maximum amount per order` on a variant and update the product
4. Customers can now only buy X amount of the variant per order. The same customer can still order the product again in
   a new order.
