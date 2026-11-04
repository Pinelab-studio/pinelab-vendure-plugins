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

## SKILL: Generate metrics with an LLM

Give your coding assistant this README and ask it to implement a custom metric in your Vendure project. Include the business definition, chart type, time period, variations, and whether results should be channel-specific. Let it inspect your installed Vendure version, database type, and any relevant custom fields before writing queries.

### Expected output

Ask the LLM to produce:

- A complete TypeScript class implementing the exported `MetricDefinition` interface, with imports and working queries—not pseudocode or placeholder data.
- A unique `code` that is a valid GraphQL enum value, and an explicit `perChannel` setting. When `true`, queries must filter by `ctx.channelId`; when `false`, the chart is calculated once using the default channel and displayed in all channels.
- An async `loadChart(ctx, injector, variation)` returning a `MetricChart`: `title`, Chart.js `type`, `data.labels`, and `data.datasets`, with optional `options` and `valueFormat`. Everything must be JSON-serializable: no callbacks or functions. Currency values must use minor units (cents) with `valueFormat: 'currency'`.
- Optional `getChartVariations(ctx, injector)` for the widget's dropdown. Each variation is calculated nightly, not when selected.
- The configuration change registering the instance in `MetricsPlugin.init({ metrics: [...] })`, preserving `defaultMetrics` if desired.
- A short explanation of query assumptions, including timezone, date boundaries, excluded order states, empty periods, and channel handling, plus steps to verify the result.

Prefer database aggregation over loading all records into memory. No new dashboard component, resolver, entity, or scheduled task is needed: the plugin stores the chart and creates the widget automatically.

### Example prompt

Copy this prompt into your coding assistant, together with this README:

```text
Implement a custom metric for @pinelab/vendure-plugin-metrics in this project.
Read the README's custom metrics documentation and inspect the installed
MetricDefinition and MetricChart types before implementing it.

Metric: number of placed orders per day, excluding Cancelled orders.
Chart: bar chart titled "Orders placed", with valueFormat: 'number'.
Variations: "Past 7 days" and "Past 30 days".
Use UTC calendar days, including today, and fill days without orders with zero.
Count by orderPlacedAt, not createdAt. Each order must be counted once.
Make it channel-specific, filtering by the supplied context's channel ID.
Use database aggregation through Vendure's TransactionalConnection, compatible
with this project's database. Do not load every order into memory.

Output a complete OrdersPlacedMetric class in a new TypeScript file and the
configuration change to register it alongside defaultMetrics. Return a
JSON-serializable MetricChart; do not build custom dashboard UI or APIs.
Explain any assumptions and how to verify the chart against existing orders.
Ask me if any required business rules or project details are unclear.
```

After adding the metric, rebuild the dashboard so its widget is registered, then run `generate-metrics` via `Settings > Scheduled tasks`. Compare the chart with known data for the selected channel and period.

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
