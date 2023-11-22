# Vendure Primary Collection Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-primary-collection)

To construct breadcrumbs and URL's it's useful to have a primary collection for each product, in case a product is part of multiple collections. This plugin extends Vendure's `Product` graphql type, adding a `primaryCollection` field that points to the primary collection of a product.

Primary collections can be selected in the Admin UI's product detail view.

This Plugin also exports `PrimaryCollectionHelperService` which can be used to assign `primaryCollection`'s to products without existing values by running `PrimaryCollectionHelperService.setPrimaryCollectionForAllProducts`.

## Getting started

Add the plugin to your `vendure-config.ts`:

```ts
plugins: [
  PrimaryCollectionPlugin.init({
    customFieldUITabName: 'Primary Collection',
  }),
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
