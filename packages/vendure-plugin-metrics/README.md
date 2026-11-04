# Vendure Metrics plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-metrics)

Show your shop's most important metrics as charts on the Vendure dashboard. Metrics are defined in code, so you can easily add your own.

## Getting started

1. Add the plugin to your `vendure-config.ts`. The plugin uses Vendure's scheduler, so make sure the `DefaultSchedulerPlugin` is installed too:

```ts
import { DefaultSchedulerPlugin } from '@vendure/core';
import { MetricsPlugin } from '@pinelab/vendure-plugin-metrics';

plugins: [
  DefaultSchedulerPlugin.init(),
  MetricsPlugin.init({}),
];
```

2. Run a database migration to add the `metric_result` table.
3. Rebuild the dashboard. Each metric is now shown as a widget on the dashboard's Insights page.
4. Charts are generated every night. Run the task `generate-metrics` manually via `Settings > Scheduled tasks` in the dashboard to see charts right away.

## How it works

**Charts are calculated nightly, never when viewing them.** A scheduled task runs every night at 02:00, calculates all metrics and stores the resulting charts in the database. The dashboard widgets only read these stored charts.

This is done for performance: metrics often need to aggregate a lot of orders. Running these queries every time someone opens the dashboard would put heavy load on your database. Metrics are also calculated one by one, never in parallel, for the same reason.

- Charts show the data up until the last time the task ran. The widget shows when the chart was last updated.
- If a metric fails, the error is logged and the previously stored charts of that metric are kept. The other metrics are still calculated.
- Before the task has run for the first time, widgets show "No data yet, charts are generated nightly".
- Charts of metrics that have been removed from the config are no longer shown.

### Widgets

Every configured metric gets its own widget on the dashboard. When a metric has variations, like "Past 7 days" and "Past 30 days", the widget shows a dropdown to switch between them. Widgets are only visible for administrators with the `ReadOrder` permission.

The dashboard registers widgets at build time, based on the configured metrics: **rebuild the dashboard after adding or removing metrics.**

### Built-in metrics

1. **Revenue**: the total of all placed orders.
2. **Average order value**: the average total of placed orders.
3. **Units sold**: the number of units sold in placed orders.

Cancelled orders are excluded. Order totals include tax when the channel's prices include tax.

Vendure assigns every order to the default channel as well, so in a multi-channel setup the default channel shows the combined metrics of all channels. Totals of channels with different currencies are summed without conversion.

Each metric has the variations "Past 7 days" and "Past 30 days" (per day) and "Past 6 months" (per month), and compares them with the same period one year earlier.

### Changing the schedule

```ts
MetricsPlugin.init({
  scheduledTask: {
    // Every night at 04:00
    schedule: (cron) => cron.everyDayAt(4, 0),
    // Defaults to 1 hour
    timeout: 2 * 60 * 60 * 1000,
  },
});
```

## Custom metrics

Implement the `MetricDefinition` interface. Its only job is returning a chart: a title, a [Chart.js](https://www.chartjs.org/docs/latest/) chart type, Chart.js data and optionally Chart.js options. You are free to query the data any way you like.

```ts
import { Injector, RequestContext, TransactionalConnection, Customer } from '@vendure/core';
import { MetricChart, MetricDefinition } from '@pinelab/vendure-plugin-metrics';

export class NewCustomersMetric implements MetricDefinition {
  // Must be a valid GraphQL enum value: letters, digits and underscores
  readonly code = 'new_customers';
  // Load charts for each channel, or once for all channels
  readonly perChannel = false;

  // Optional: shown as dropdown on the widget. Can also be async, for example to get your top 5 products.
  getChartVariations(ctx: RequestContext, injector: Injector): string[] {
    return ['Past 6 months', 'Past 12 months'];
  }

  // Called nightly, once per variation
  async loadChart(
    ctx: RequestContext,
    injector: Injector,
    variation: string | undefined,
  ): Promise<MetricChart> {
    const months = variation === 'Past 12 months' ? 12 : 6;
    const counts = await this.countNewCustomersPerMonth(ctx, injector, months);
    return {
      title: 'New customers',
      type: 'bar',
      // 'number' or 'currency'. Currency values should be in minor units (cents), like all prices in Vendure.
      valueFormat: 'number',
      data: {
        labels: counts.map((c) => c.month),
        datasets: [{ label: 'New customers', data: counts.map((c) => c.count) }],
      },
    };
  }

  private async countNewCustomersPerMonth(ctx: RequestContext, injector: Injector, months: number) {
    const repository = injector.get(TransactionalConnection).getRepository(ctx, Customer);
    // Your query here
  }
}
```

Add it to the plugin, together with the built-in metrics if you want to keep them:

```ts
import { MetricsPlugin, defaultMetrics } from '@pinelab/vendure-plugin-metrics';

MetricsPlugin.init({
  metrics: [...defaultMetrics, new NewCustomersMetric()],
});
```

Things to keep in mind:

- Each variation can return a completely different chart: the dropdown on the widget just switches between them.
- The chart is stored as JSON, so it can't contain functions, like Chart.js formatting callbacks. Use `valueFormat` to have values formatted as currency or numbers on the axis and tooltips.
- The returned chart is validated: a chart without `title`, `type` or `data.datasets` is not stored and the error is logged.

## Migrating from v3

v4 is a complete rewrite:

- The `MetricStrategy` interface has been replaced by `MetricDefinition`: implement `loadChart()` instead of `calculateDataPoints()`. Metrics now query their own data.
- The option `displayPastMonths` has been removed: metrics decide which period to show, via variations.
- Selecting variants in the widget is no longer supported.
- The built-in metric code `revenue-per-product` is now `revenue`, and `units-sold` is now `units_sold`.
- The GraphQL query `advancedMetricSummaries` has been replaced by `metricCharts(code)`.
- The deprecated `pageVisit` mutation has been removed from the Shop API.
- Charts are no longer calculated when viewing the dashboard, but nightly by a scheduled task. Install the `DefaultSchedulerPlugin`.
- The `metric_summary` table has been replaced by `metric_result`. Run a database migration.

### Contributions

Special thanks to [@dalyathan](https://github.com/dalyathan) for his contributions on this plugin.
