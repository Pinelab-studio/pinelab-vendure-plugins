import type {
  Injector,
  RequestContext,
  ScheduledTaskConfig,
} from '@vendure/core';
import type { ChartData, ChartOptions, ChartType } from 'chart.js';

/**
 * How the dashboard formats the values of a chart.
 * `currency` values are expected in minor units (cents), like all prices in Vendure.
 */
export type MetricValueFormat = 'currency' | 'number';

/**
 * The chart a metric strategy returns. `type`, `data` and `options` are passed to Chart.js as-is,
 * so they must be JSON serializable: functions (like formatting callbacks) are lost when stored.
 */
export interface MetricChart {
  title: string;
  type: ChartType;
  data: ChartData;
  options?: ChartOptions;
  /**
   * Defaults to `number`
   */
  valueFormat?: MetricValueFormat;
}

/**
 * A metric is calculated by a strategy. The plugin calls the strategy nightly,
 * stores the returned charts and shows them in a dashboard widget.
 */
export interface MetricStrategy {
  /**
   * Unique code of the metric. Must be a valid GraphQL enum value, e.g. `units_sold`,
   * because it is exposed as such for the dashboard to create a widget per metric.
   */
  code: string;
  /**
   * When true, charts are loaded and stored for each channel.
   * When false, charts are loaded once (with the default channel) and shown in all channels.
   */
  perChannel: boolean;
  /**
   * Optional list of variations shown as a dropdown on the widget, e.g. `['Past 7 days', 'Past 30 days']`,
   * or dynamically resolved like the names of your top 5 products.
   * Resolved nightly: `loadChart` is called once for each variation.
   */
  getChartVariations?(
    ctx: RequestContext,
    injector: Injector,
  ): string[] | Promise<string[]>;
  /**
   * Load the chart for the given variation. `variation` is undefined when no variations are defined.
   * Each variation may return a completely different chart.
   */
  loadChart(
    ctx: RequestContext,
    injector: Injector,
    variation: string | undefined,
  ): Promise<MetricChart>;
}

export interface MetricsPluginOptions {
  /**
   * The metrics to calculate. Each metric gets its own dashboard widget.
   */
  metrics: MetricStrategy[];
  /**
   * Change when the metrics are calculated, or the timeout of the task.
   * Defaults to every night at 02:00, with a timeout of 1 hour.
   */
  scheduledTask?: Partial<Pick<ScheduledTaskConfig, 'schedule' | 'timeout'>>;
}
