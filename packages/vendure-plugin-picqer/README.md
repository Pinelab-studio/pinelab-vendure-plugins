# Vendure Picqer Plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-picqer/dev/@vendure/core)

Vendure plugin to sync orders, stock and catalogue with Picqer.com order pick platform.

- Sync placed orders that are ready to pick to Picqer
- Sync all products to Picqer
- Pull stocklevels from Picqer into Vendure

The plugin adheres the following principles:

- Vendure should be considered the source of truth for product presentation: Assets, descriptions and names are synced from Vendure to Picqer
- Picqer should be considered the source of truth for stock levels.

## Getting started

Add the plugin to your `vendure-config.ts`

```ts
// vendure-config.ts

import {PicqerPlugin} from 'vendure-plugin-picqer'

...
plugins: [
  PicqerPlugin.init({
    /**
     * Optional strategy to push additional fields to Picqer.
     * This example pushes variant.sku as product.barcode to Picqer
     */
    pushFieldsToPicqer: (variant) => ({ barcode: variant.sku })
  }),
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [
        PicqerPlugin.ui,
        ... // your other plugin UI extensions
      ],
    }),
  }),
... // your other plugins
]

```
