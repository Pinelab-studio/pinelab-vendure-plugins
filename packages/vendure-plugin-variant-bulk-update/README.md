# Vendure Plugin for bulk updating all variants of a product

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-variant-bulk-update)

Tiny plugin that allows you to update the prices of all variants for a given product. This is especially useful for
products with a lot of variants.

## Getting started

1. Add the plugin config to your `vendure-config.ts`:

```ts
import {VariantBulkUpdatePlugin} from 'vendure-plugin-variant-bulk-update';

plugins: [
  VariantBulkUpdatePlugin,
  ...
];
```

2. Run a database migration to add the price field on a product.
3. Start Vendure, login and go to a product.
4. Set the field `price` of a product to €300 and save the product.
5. All variants of the product will now be €300.

If you only want to update variants once, you should clear the `product.customFields.price` field again. When
the `price` field has a value, and a product is updated, all variants will be updated again.

Update of variants is done async, so it might happen that you need to refresh your product page to fetch the updated prices.

## Contribute

This plugin can easily be extendded to also bulk update other fields than price. So, Pull Requests are always welcome!
