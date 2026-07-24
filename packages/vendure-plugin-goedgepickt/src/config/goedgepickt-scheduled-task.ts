import {
  Channel,
  Logger,
  ScheduledTask,
  TransactionalConnection,
} from '@vendure/core';
import { GoedgepicktService } from '../api/goedgepickt.service';
import { loggerCtx } from '../constants';

/**
 * Scheduled task that runs a full GoedGepickt sync for all enabled channels.
 * Pushes all Vendure products to GoedGepickt and updates stock levels.
 */
export const goedgepicktFullSyncTask = new ScheduledTask({
  id: 'goedgepickt-full-sync',
  description: 'Sync products and stock with GoedGepickt',
  schedule: (cron) => cron.everyDayAt(2, 0),
  async execute({ injector }) {
    const connection = injector.get(TransactionalConnection);
    const service = injector.get(GoedgepicktService);
    const channels = await connection.getRepository(Channel).find();
    const enabledChannels = channels.filter((c) => c.customFields?.ggEnabled);
    let syncedChannels = 0;
    for (const channel of enabledChannels) {
      await service.doFullSync(channel.token).catch((err) => {
        Logger.error(
          `Failed to create fullsync jobs for channel ${channel.id}: ${err.message}`,
          loggerCtx
        );
      });
      syncedChannels++;
    }
    return { syncedChannels };
  },
});
