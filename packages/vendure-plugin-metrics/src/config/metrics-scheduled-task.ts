import { ScheduledTask } from '@vendure/core';
import { MetricsService } from '../services/metrics.service';
import type { MetricsPluginOptions } from '../types';

/**
 * Calculates and stores the charts of all metrics. Can also be run on demand
 * via Vendure's built-in Scheduled Tasks screen in the dashboard.
 */
export const metricsScheduledTask = new ScheduledTask({
  id: 'generate-metrics',
  description: 'Calculate and store the charts of all configured metrics',
  schedule: (cron) => cron.everyDayAt(2, 0),
  timeout: 60 * 60 * 1000, // 1 hour
  async execute({ injector }) {
    const result = await injector.get(MetricsService).generateAllCharts();
    for (const metric of result.metrics) {
      metric.variations.sort((a, b) => b.durationMs - a.durationMs);
    }
    result.metrics.sort(
      (a, b) =>
        b.variations.reduce((total, v) => total + v.durationMs, 0) -
        a.variations.reduce((total, v) => total + v.durationMs, 0),
    );
    return result;
  },
});

/**
 * Returns the metrics task, with the schedule or timeout overridden by the plugin options
 */
export function buildMetricsScheduledTask(
  option?: MetricsPluginOptions['scheduledTask'],
): ScheduledTask {
  return option ? metricsScheduledTask.configure(option) : metricsScheduledTask;
}
