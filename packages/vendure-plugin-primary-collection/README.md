# Vendure Primary Collection Plugin

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

To construct breadcrumbs and URL's it's useful to have a primary collection for each product, in case a product is part of multiple collections. This plugin extends Vendure's `Product` graphql type adding a `primaryCollection` field which points to the primary collection of a product, which can be selected in the product detail view, from a list of collections to which the product belongs.

## Getting started

Add the plugin to your `vendure-config.ts`:

```ts
plugins: [
  PrimaryCollectionPlugin,
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [PrimaryCollectionPlugin.ui],
    }),
  }),
];
```

And your good to go with just that.
