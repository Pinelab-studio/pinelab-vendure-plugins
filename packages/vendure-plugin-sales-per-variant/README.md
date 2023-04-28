# Vendure Sales Per Variant plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-sales-per-variant/dev/@vendure/core)

A plugin to measure and visualize your shop's conversion rate (CRV), average order value (AOV) and number of orders per
month or per week, for the past 12 months (or weeks) per variants.

## Getting started

1. Configure the plugin in `vendure-config.ts`:

```ts
import { SalesPerVariantPlugin } from "vendure-plugin-sales-per-variant";

plugins: [
  ...
    SalesPerVariantPlugin,
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
3. You should now be able to select `product metrics` when you click on the button `add widget`

Metric results are cached in memory to prevent heavy database queries everytime a user opens its dashboard.

### Default metrics

1. Conversion Rate (CVR): this is the conversion rate of active sessions that converted to placed orders per week/month.
2. Average Order Value (AOV): The average of `order.totalWithTax` of the orders per week/month
3. Nr of orders: The number of order per week/month

### Custom metrics

You can implement your own metrics by implementing the `MetricCalculation` interface. If you need any order relations
you can specify them on plugin initialisation.

#### Example: Average amount of items per order

Let's say we want to show the average amount of items per order, per week/month.

1. Implement the `MetricCalculation` interface:

```ts
import {
  MetricCalculation,
  MetricInterval,
  MetricData,
  getMonthName,
  MetricSummaryEntry,
} from 'vendure-plugin-metrics';
import { RequestContext } from '@vendure/core';

export class AmountOfItemsMetric implements MetricCalculation {
  readonly code = 'item-amounts';

  getTitle(ctx: RequestContext): string {
    return `Average items per order`;
  }

  calculateEntry(
    ctx: RequestContext,
    interval: MetricInterval,
    weekOrMonthNr: number,
    data: MetricData
  ): MetricSummaryEntry {
    // Creates labels like 'Jan' or 'Week 32'
    const label =
      interval === MetricInterval.Monthly
        ? getMonthName(weekOrMonthNr)
        : `Week ${weekOrMonthNr}`;
    // No orders equals 0 products
    if (!data.orders.length) {
      return {
        label,
        value: 0,
      };
    }
    // Sum up all orderLines
    let productCounter = 0;
    data.orders.forEach((order) =>
      order.lines.forEach((line) => (productCounter += line.quantity))
    );
    // Calculate average per order
    const average = Math.round(productCounter / data.orders.length);
    return {
      label,
      value: average,
    };
  }
}
```

2. Pass your new metric to the MetricPlugin in your `vendure-config.ts`:

```ts
import {
  MetricsPlugin,
  ConversionRateMetric,
} from 'vendure-plugin-plugin-sales-per';

const vendureConfig = {
  pugins: [
    MetricsPlugin.init({
      // Tell the plugin to also fetch order.lines for our new metric
      orderRelations: ['lines'],
      // This will only show CVR and the new Item amount metrics
      metrics: [new ConversionRateMetric(), new MetricSummaryEntry()],
    }),
  ],
  // You don't need to rebuild your admin ui!
};
```

3. Start your server, and see your new metric on the dashboard!
