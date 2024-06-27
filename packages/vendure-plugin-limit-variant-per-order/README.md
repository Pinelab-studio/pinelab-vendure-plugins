# Vendure Plugin for limiting the amount of specific product variants per order

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-limit-product-per-order)

This plugin allows you to:

1. Limit the amount of a specific product variant per order. I.E. A customer is only allowed to
   buy 1 of product "Limited art t-shirt X" per order.
2. Only allow a product to be purchased in multiples of X. E.g. only per 4.

## Getting started

1. Add the following config to your `vendure-config.ts`:

```ts
plugins: [LimitVariantPerOrderPlugin];
```

2. Start Vendure, login and go to the product you want to limit.
3. Set the custom field `Maximum amount per order` and `Multiple of per order` on a variant and update the product
4. Customers can now only buy X amount of the variant per order. The same customer can still order the product again in
   a new order.
