import {
  Channel,
  Logger,
  ScheduledTask,
  TransactionalConnection,
} from '@vendure/core';
import { GoedgepicktService } from '../api/goedgepickt.service';
import { loggerCtx } from '../constants';

/**
 * Scheduled task that pulls stock levels from GoedGepickt for all enabled channels.
 */
export const goedgepicktSyncStockTask = new ScheduledTask({
  id: 'goedgepickt-sync-stock',
  description: 'Sync stock levels from GoedGepickt',
  schedule: (cron) => cron.everyDayAt(2, 0),
  async execute({ injector }) {
    const connection = injector.get(TransactionalConnection);
    const service = injector.get(GoedgepicktService);
    const channels = await connection.getRepository(Channel).find();
    const enabledChannels = channels.filter((c) => c.customFields?.ggEnabled);
    let syncedChannels = 0;
    for (const channel of enabledChannels) {
      await service.pullAllStocklevels(channel.token).catch((err) => {
        Logger.error(
          `Failed to pull stock levels for channel ${channel.id}: ${err.message}`,
          loggerCtx
        );
      });
      syncedChannels++;
    }
    return { syncedChannels };
  },
});

/**
 * Scheduled task that pushes all Vendure products to GoedGepickt for all enabled channels.
 */
export const goedgepicktPushProductsTask = new ScheduledTask({
  id: 'goedgepickt-push-products',
  description: 'Push all products to GoedGepickt',
  schedule: (cron) => cron.everyMondayAt(6, 0),
  async execute({ injector }) {
    const connection = injector.get(TransactionalConnection);
    const service = injector.get(GoedgepicktService);
    const channels = await connection.getRepository(Channel).find();
    const enabledChannels = channels.filter((c) => c.customFields?.ggEnabled);
    let pushedChannels = 0;
    for (const channel of enabledChannels) {
      await service.pushAllProductsToGoedgepickt(channel.token).catch((err) => {
        Logger.error(
          `Failed to push products for channel ${channel.id}: ${err.message}`,
          loggerCtx
        );
      });
      pushedChannels++;
    }
    return { pushedChannels };
  },
});
