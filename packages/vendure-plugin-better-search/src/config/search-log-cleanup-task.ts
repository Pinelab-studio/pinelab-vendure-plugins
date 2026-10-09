import { ScheduledTask } from '@vendure/core';
import { SearchLogService } from '../services/search-log.service';

/** Bounds search log history per channel nightly at 4:30 AM. */
export const betterSearchLogCleanupTask = new ScheduledTask({
  id: 'better-search-log-cleanup',
  description: 'Removes search logs beyond the configured per-channel limit',
  schedule: (cron) => cron.everyDayAt(4, 30),
  /** Executes SQL retention cleanup using the worker injector. */
  async execute({ injector }) {
    await injector.get(SearchLogService).cleanup();
  },
});
