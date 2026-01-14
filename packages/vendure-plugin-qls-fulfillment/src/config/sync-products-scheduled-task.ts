import {
  ChannelService,
  Logger,
  RequestContext,
  RequestContextService,
  ScheduledTask,
} from '@vendure/core';

import { QlsProductService } from '../services/qls-product.service';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { QlsPluginOptions } from '../types';

/**
 * Synchronize all products to QLS for all channels, every day at 3:00 AM.
 */
export const qlsSyncAllProductsTask = new ScheduledTask({
  id: 'full-sync-qls-products',
  description: 'Trigger a full sync of products to QLS',
  params: {},
  schedule: (cron) => cron.everyDayAt(3, 0),
  async execute({ injector }) {
    const qlsProductService = injector.get(QlsProductService);
    // Verify for what channels we need to trigger QLS full sync
    const ctx = await injector.get(RequestContextService).create({
      apiType: 'admin',
    });
    const channels = await injector.get(ChannelService).findAll(ctx);
    let fullSyncCompleted = 0;
    for (const channel of channels.items) {
      // Create ctx for channel
      const channelCtx = new RequestContext({
        apiType: 'admin',
        channel: channel,
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
      });
      const options = injector
        .get<QlsPluginOptions>(PLUGIN_INIT_OPTIONS)
        .getConfig(channelCtx);
      if (!options) {
        Logger.info(`QLS not enabled for channel ${channel.token}`, loggerCtx);
        continue;
      }
      await qlsProductService.runFullSync(channelCtx);
      fullSyncCompleted += 1;
    }
    return {
      message: `Finnished full sync for ${fullSyncCompleted} channels`,
    };
  },
});
