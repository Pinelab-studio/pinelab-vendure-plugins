# Vendure Primary Collection Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-primary-collection)

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

## Migrating from `1.6.0` to `2.0.0`

1. Always create a backup of your database
2. Install the plugin and generate a migration
3. In your migration file, add the function `exportCurrentPrimaryCollections(queryRunner)` to the top and `savePrimaryCollection(queryRunner)` to the bottom of the `up` function in your migration file, like so

```ts
import { exportCurrentPrimaryCollections, savePrimaryCollection } from "@pinelab/vendure-plugin-primary-collection";

   public async up(queryRunner: QueryRunner): Promise<any> {
        // add this line
        await exportCurrentPrimaryCollections(queryRunner)
        await queryRunner.query("ALTER TABLE `product` DROP FOREIGN KEY `FK_5e6c3c845407ccaa497eca1a865`", undefined);
        await queryRunner.query("ALTER TABLE `product` CHANGE `customFieldsPrimarycollectionid` `customFieldsPrimarycollection` int NULL", undefined);
        await queryRunner.query("ALTER TABLE `product` DROP COLUMN `customFieldsPrimarycollection`", undefined);
        await queryRunner.query("ALTER TABLE `product` ADD `customFieldsPrimarycollection` varchar(255) NULL", undefined);
        //...and this line
        await savePrimaryCollection(queryRunner)
   }
```

4. Run the migration.
