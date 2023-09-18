# Vendure Primary Collection Plugin

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

To construct breadcrumbs and URL's it's useful to have a primary collection for each product, in case a product is part of multiple collections. This plugin extends `vendure`'s `Product` graphql type adding a `primaryCollection` field which points to the primary collection of a product, which is the the highest placed collection in Vendure (Collection's are sortable in Vendure, and it's a good practice to sort by importance).

## Getting started

Add the plugin to your `vendure-config.ts`:

```ts
plugins: [PrimaryCollectionPlugin];
```

and your good to go with this just that.
