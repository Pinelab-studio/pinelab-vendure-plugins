# Vendure Plugin for admin Components

This plugin provides us with invoice related admin ui components that will be commonly shared by the `vendure-plugin-invoices` and `vendure-plugin-picklist` plugins.

## Getting started

1. Add the following config to your `vendure-config.ts`:

```ts
    plugins: [
        PinelabAdminComponentsPlugin.init(),
        AdminUiPlugin.init({
            port: 3002,
            route: 'admin',
            app: compileUiExtensions({
            outputPath: path.join(__dirname, '__admin-ui'),
            extensions: [
                PinelabAdminComponentsPlugin.ui
            ],
        }),
        }),
    ],
```

2. In your angular module, register the content component

```ts
import { ContentComponentRegistryService } from '@pinelab/pinelab-plugin-admin-components';
import { InvoiceListComponent } from './invoice-list.component';
export class InvoicesListModule {
  constructor(
    private contentComponentRegistryService: ContentComponentRegistryService
  ) {
    this.contentComponentRegistryService.registerContentComponent(
      InvoiceListComponent
    );
  }
}
```

## Increase invoice template DB storage

By default, the plugin uses TypeOrm's `text` to store the template in the DB. This might not be enough, for example when you'd like to add base64 encoded images to your invoices. This will result in the error `ER_DATA_TOO_LONG: Data too long for column 'templateString'`. You can specify your DB engine with an env variable, and the plugin will resolve the correct column type:

```shell
# E.g. For mysql the column type 'longtext' will be used, which supports up to 4gb
INVOICES_PLUGIN_DB_ENGINE=mysql
```

## Custom invoice numbering and custom data

Implement the `DataStrategy` to pass custom data to your template or generate custom invoice numbers:

```ts
export class DefaultDataStrategy implements DataStrategy {
  async getData({
    ctx,
    injector,
    order,
    latestInvoiceNumber,
  }: DataFnInput): Promise<InvoiceData> {
    // Do something with the data
    return {
      invoiceNumber: String(Math.floor(Math.random() * 90000) + 10000),
      customerEmail: 'just used for admin display',
      order,
      someCustomField: '2022',
    };
  }
}
```

You can access this data in your HTML template using Handlebars.js:

```html
<h1>{{ someCustomField }}</h1>
```
