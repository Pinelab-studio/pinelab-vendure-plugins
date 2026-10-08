import { ScheduledTask } from '@vendure/core';
import { ContentCheckService } from '../services/content-check.service';
import { ContentHealthPluginOptions } from '../types';

/**
 * @description
 * Runs a full content/SEO scan of all non-excluded products and
 * collections, across every enabled channel and language. Always
 * registered; runnable on demand via Vendure's built-in Scheduled Tasks
 * admin screen, satisfying the on-demand-scan requirement without a custom
 * "run now" mutation/UI.
 */
export const contentHealthScanTask = new ScheduledTask({
  id: 'content-health-full-scan',
  description: 'Run a full content/SEO scan of all products and collections',
  schedule: (cron) => cron.everyDayAt(3, 0),
  async execute({ injector }) {
    return injector.get(ContentCheckService).runFullScan();
  },
});

/**
 * Returns the full-scan {@link ScheduledTask}, optionally overriding its
 * schedule/timeout from the plugin's `scheduledTask` option.
 *
 * NOTE: `ScheduledTask.configure()` mutates and returns the same instance,
 * so this returns the shared `contentHealthScanTask` singleton.
 */
export function buildContentHealthScanTask(
  option?: ContentHealthPluginOptions['scheduledTask']
): ScheduledTask {
  return option
    ? contentHealthScanTask.configure(option)
    : contentHealthScanTask;
}
