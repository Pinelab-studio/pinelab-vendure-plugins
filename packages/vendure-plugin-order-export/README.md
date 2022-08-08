![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-order-export/dev/@vendure/core)

# Vendure Order export plugin

This plugin allows administrators to export orders to a file. The default exports orders and their totals to a
csv file. You can implement your own strategy to determine what and how data is exported.

1. Go to the admin ui, sales > order-export
2. Select a date range
3. Download your export file!

The plugin currently processes the export in the main thread, so be careful with heavy tasks in your strategy.

## Plugin setup

1. Add the server and admin UI extensions in your `vendure-config.ts`

```js
// Server plugin
plugins: [
  OrderExportPlugin.init({
    // Optionally add your own strategies here
    exportStrategies: [],
  }),
];
```

```js
// Admin UI extension
AdminUiPlugin.init({
  port: 3002,
  route: 'admin',
  app: compileUiExtensions({
    outputPath: path.join(__dirname, '__admin-ui'),
    extensions: [OrderExportPlugin.ui],
  }),
});
```

2. Make sure your user has the permission `ExportOrders`
3. After starting your server, you should be able to see the `Export orders` in the menu on the left side, under '
   sales.'
4. Select a date range, select an export strategy and click export!

## Export strategies

You can easily implement your own export strategy and pass it to the plugin:

```ts
import { ExportStrategy } from 'vendure-plugin-order-export';
import { promises as fs } from 'fs';
import { createObjectCsvWriter } from 'csv-writer';

export class MyCustomExport implements ExportStrategy {
  // Name as shown in the admin UI
  readonly name = 'my-custom-export';
  // Content-type of your export file
  readonly contentType = 'text/csv';
  // File extension of your export file
  readonly fileExtension = 'csv';

  async createExportFile({
    ctx,
    startDate,
    endDate,
    orderService,
  }: ExportInput): Promise<string> {
    const orders = await orderService.findAll(
      ctx,
      {
        filter: {
          orderPlacedAt: {
            between: {
              start: startDate,
              end: endDate,
            },
          },
        },
      },
      ['lines.productVariant']
    );
    // Do your magic with the order data here
    const filePath = '/tmp/your-temp-file.csv';
    const csvWriter = createObjectCsvWriter({ path: filePath });
    await csvWriter.writeRecords({ data: 'your custom data' });
    return filePath;
  }
}
```

Don't forget to add the strategy to your plugin:

```ts
plugins: [
  OrderExportPlugin.init({
    exportStrategies: [new MyCustomExport()],
  }),
];
```

## Enjoying our plugins?

Enjoy the Pinelab Vendure plugins? [Consider becoming a sponsor](https://github.com/sponsors/Pinelab-studio).

Or check out [pinelab.studio](https://pinelab.studio) for more articles about our integrations.
<br/>
<br/>
<br/>
[![Pinelab.studio logo](https://pinelab.studio/assets/img/favicon.png)](https://pinelab.studio)
