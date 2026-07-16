import { ScheduledTask } from '@vendure/core';
import { FrequentlyBoughtTogetherService } from '../services/frequently-bought-together.service';
import { ScheduledTaskOption } from '../types';

/**
 * Scheduled task that recalculates "frequently bought together" product
 * relations for all channels.
 *
 * This task is always registered by the {@link FrequentlyBoughtTogetherPlugin}.
 * Use the plugin's `scheduledTask` option to change when it runs. The
 * `DefaultSchedulerPlugin` must be present for the task to run.
 *
 * @example
 * ```ts
 * FrequentlyBoughtTogetherPlugin.init({
 *   // Default: nightly at 3:00 AM. Change the schedule:
 *   scheduledTask: { schedule: (cron) => cron.everyDayAt(4, 0) },
 * }),
 * ```
 */
export const frequentlyBoughtTogetherTask = new ScheduledTask({
  id: 'frequently-bought-together-calculation',
  description:
    'Recalculate "frequently bought together" product relations for all channels',
  schedule: (cron) => cron.everyDayAt(3, 0),
  async execute({ injector }) {
    const channelCount = await injector
      .get(FrequentlyBoughtTogetherService)
      .triggerCalculationForAllChannels();
    return { channelsQueued: channelCount };
  },
});

/**
 * Returns the recalculation {@link ScheduledTask}, optionally overriding its
 * schedule/timeout from the plugin's `scheduledTask` option. The task is always
 * returned (it cannot be disabled) — the option only changes when it runs.
 *
 * NOTE: `ScheduledTask.configure()` mutates and returns the same instance, so
 * this returns the shared `frequentlyBoughtTogetherTask` singleton.
 */
export function buildFrequentlyBoughtTogetherTask(
  option?: ScheduledTaskOption
): ScheduledTask {
  return option
    ? frequentlyBoughtTogetherTask.configure(option)
    : frequentlyBoughtTogetherTask;
}
