import { RequestContextService, ScheduledTask } from '@vendure/core';

import { QlsProductService } from '../services/qls-product.service';

export const fullProductSyncTask = new ScheduledTask({
  id: 'full-sync-qls-products',
  description: 'Trigger a full sync of products to QLS',
  params: {},
  schedule: (cron) => cron.everyDayAt(3, 0),
  async execute({ injector }) {
    const qlsProductService = injector.get(QlsProductService);

    const ctx = await injector.get(RequestContextService).create({
      apiType: 'admin',
    });

    const result = await qlsProductService.triggerFullSyncProducts(ctx);

    return {
      job: {
        createdAt: result.createdAt,
        id: result.id,
      },
    };
  },
});
