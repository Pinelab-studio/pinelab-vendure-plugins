# Vendure Picklist Plugin

A plugin for generating PDF picklists for orders.

## Getting started

Add the following config to your `vendure-config.ts`:

```ts
import {PicklistPlugin} from '@pinelab/vendure-plugin-picklist';
    plugins: [
        PicklistPlugin,
        AdminUiPlugin.init({
            port: 3002,
            route: 'admin',
            app: compileUiExtensions({
            outputPath: path.join(__dirname, '__admin-ui'),
            extensions: [
                PicklistPlugin.ui
            ],
        }),
        }),
    ],
```

## Increase invoice template DB storage

By default, the plugin uses TypeOrm's `text` to store the template in the DB. This might not be enough, for example when you'd like to add base64 encoded images to your invoices. This will result in the error `ER_DATA_TOO_LONG: Data too long for column 'templateString'`. You can specify your DB engine with an env variable, and the plugin will resolve the correct column type:

```shell
# E.g. For mysql the column type 'longtext' will be used, which supports up to 4gb
INVOICES_PLUGIN_DB_ENGINE=mysql
```
