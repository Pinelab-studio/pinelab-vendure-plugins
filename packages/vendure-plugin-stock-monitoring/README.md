# Vendure stock monitoring plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-stock-monitoring)

This plugin helps you monitor the stock levels in two ways:

1. A dashboard widget that displays variants that have stock level's below their threshold
2. An event is emitted when a variant's stock level drops below a given threshold after each placed order.

## Getting started

1. Add the plugin to your `vendure-config.ts` to expose a `productVariantsWithLowStock` query in the admin API.

```ts
import { StockMonitoringPlugin } from '@pinelab/vendure-plugin-stock-monitoring';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';

plugins: [
  StockMonitoringPlugin.init({
    globalThreshold: 10,
    uiTab: 'My Admin UI Tab',
  }),
  // Add the widget to the admin ui
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [StockMonitoringPlugin.ui],
    }),
  }),
];
```

For more configuration options regarding the admin
ui, [check the docs](https://www.vendure.io/docs/plugins/extending-the-admin-ui/).

When you start the server and login, you can find `stock-levels` under the `add widgets` button.

### Caveats

This plugin doesn't use the `StockLocationStrategy` because of performance reasons. Instead, it fetches the stock level for each variant from the database and calculates its absolute stock based on the `stockOnHand` and `stockAllocated` fields.
