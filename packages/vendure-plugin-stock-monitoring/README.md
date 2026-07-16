# Vendure stock monitoring plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-stock-monitoring)

This plugin helps you monitor the stock levels in two ways:

1. A dashboard widget that displays variants that have stock level's below their threshold
2. An event is emitted when a variant's stock level drops below a given threshold after each placed order.

## Getting started

1. Add the plugin to your `vendure-config.ts` to expose a `productVariantsWithLowStock` query in the admin API.

```ts
import { StockMonitoringPlugin } from '@pinelab/vendure-plugin-stock-monitoring';

plugins: [
  StockMonitoringPlugin.init({
    globalThreshold: 10,
    uiTab: 'My Admin UI Tab',
  }),
];
```

The "Low stock" widget is provided as a React Dashboard extension — no Admin UI compilation step is needed.

When you start the server and login, you can find `Low stock` under the dashboard's `add widget` button.

### Caveats

1. This plugin doesn't use the `StockLocationStrategy` because of performance reasons. Instead, it fetches the stock level for each variant from the database and calculates its absolute stock based on the `stockOnHand` and `stockAllocated` fields.
2. Stock notifications are only emitted after an order is placed. Manual stock changes via the admin UI will not trigger a notification.
