# Vendure Metrics plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-sales-per-variant/dev/@vendure/core)

A plugin to measure and visualize your shop's average order value (AOV),number of orders per
month or per week and number of items per product variant for the past 12 months (or weeks) per variants.

![image](https://user-images.githubusercontent.com/6604455/236404288-e55c37ba-9508-43e6-a54c-2eb7b3cd36ee.png)

## Getting started

1. Configure the plugin in `vendure-config.ts`:

```ts
import { MetricsPlugin } from "vendure-plugin-metrics";

plugins: [
  ...
    MetricsPlugin,
    AdminUiPlugin.init({
      port: 3002,
      route: 'admin',
      app: compileUiExtensions({
        outputPath: path.join(__dirname, '__admin-ui'),
        extensions: [SalesPerVariantPlugin.ui],
      }),
    }),
  ...
]
```

2. Start your Vendure server and login as administrator
3. You should now be able to select `metrics` when you click on the button `add widget`

Metric results are cached in memory to prevent heavy database queries every time a user opens its dashboard.

### Metrics

1. Average Order Value (AOV): The average of `order.totalWithTax` of the orders per week/month
2. Nr of items: The number of items sold. When no variants are selected, this metric counts the total nr of items in an order.
3. Nr of orders: The number of order per week/month

# Breaking changes since 5.x

For simplicity and performance reasons, we decided it makes more sense to display our 3 metrics of choice, and not have metrics extensible with custom Metrics for now. This is what changes in your `vendure-config`:

```diff
- plugins: [
-   MetricsPlugin.init({
-     metrics: [
-       new NrOfOrdersMetric(),
-       new AverageOrderValueMetric(),
-       new ConversionRateMetric(),
-       new RevenueMetric(),
-     ],
-  }),
- ]
+ plugins: [
+     MetricsPlugin,
+ ]
```

You can now also view metrics per variant(s) if you'd like.

### Contributions

Thanks [@dalyathan](https://github.com/dalyathan) for his contributions on this plugin.
