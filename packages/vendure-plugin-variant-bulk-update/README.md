# Vendure Plugin for bulk updating all variants of a product

### [Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-variant-bulk-update)

Tiny plugin that allows you to update the prices and/or custom fields of all variants for a given product. Useful for when all your variants have the same price for example.

## Bulk updating price

This example shows you how to update the price of all variants of a product. E.g. updating the price of a product to €10, will set the price of all it's variants to €10. This setup needs a DB migration, because it adds a custom field to Product.

1. Add the plugin config to your `vendure-config.ts`:

```ts
import {VariantBulkUpdatePlugin} from '@pinelab/vendure-plugin-variant-bulk-update';

plugins: [
        VariantBulkUpdatePlugin.init({
          // Allow bulk updating of price
          enablePriceBulkUpdate: true,
          // This example doesn't update any custom fields
          bulkUpdateCustomFields: []
        }),
  ...
];
```

2. Run a database migration to add the price field on a product.
3. Start Vendure, login and go to a product.
4. Set the field `price` of a product to €300 and save the product.
5. All variants of the product will now be €300.

If you only want to update variants once, you should clear the `product.customFields.price` field again. When
the `price` field has a value, and a product is updated, all variants will be updated again.

The bulk update is async, so you might need to refresh your product page to see the updated variants.

## Bulk updating custom fields

This example shows you how to bulk update any custom field on all variants of a product. This example uses the custom field `noLongerAvailable`, but it can be any custom field.

1. Make sure you have a custom field `noLongerAvailable` configured on **both the Product and ProductVariant**
2. Add the plugin to your config

```ts
import {VariantBulkUpdatePlugin} from '@pinelab/vendure-plugin-variant-bulk-update';

plugins: [
        VariantBulkUpdatePlugin.init({
          enablePriceBulkUpdate: false,
          bulkUpdateCustomFields: ['noLongerAvailable']
        }),
  ...
];
```

3. Start the server, and set a product's `noLongerAvailable` to true.
4. All variants should now also have `noLongerAvailable=true`;

The bulk update is async, so you might need to refresh your product page to see the updated variants.
