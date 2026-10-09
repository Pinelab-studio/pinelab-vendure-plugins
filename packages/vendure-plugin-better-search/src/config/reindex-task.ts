import { ScheduledTask } from '@vendure/core';
import { IndexService } from '../services/index.service';

/** Queues full search reindex jobs for all enabled channels every night. */
export const betterSearchReindexTask = new ScheduledTask({
  id: 'better-search-reindex',
  description: 'Queues full search reindex jobs for all enabled channels',
  schedule: (cron) => cron.everyDayAt(4, 0),
  async execute({ injector }) {
    await injector.get(IndexService).triggerReindexForAllChannels();
  },
});
