# Vendure Order Export Plugin

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-order-export)

This plugin allows administrators to export orders to a file. The default exports orders and their totals to a csv file.
You can implement your own strategy to determine what and how data is exported.

## Getting started

1. Add the server and admin UI extensions in your `vendure-config.ts`

```ts
import { OrderExportPlugin } from '@pinelab/vendure-plugin-order-export';

// Server plugin
plugins: [
  OrderExportPlugin.init({
    // Optionally add your own strategies here
    exportStrategies: [],
  }),
   AdminUiPlugin.init({
      port: 3002,
      route: 'admin',
      app: compileUiExtensions({
         outputPath: path.join(__dirname, '__admin-ui'),
         extensions: [OrderExportPlugin.ui],
      }),
   }),
   ...
];
```

2. Make sure your user has the permission `ExportOrders`
3. After starting your server, you should be able to see the `Export orders` in the menu on the left side, under '
   sales.'
4. Select a date range, select an export strategy and click export!

### Custom export strategies

You can easily implement your own export strategy and pass it to the plugin:

```ts
import { ExportStrategy } from '@pinelab/vendure-plugin-order-export';
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
