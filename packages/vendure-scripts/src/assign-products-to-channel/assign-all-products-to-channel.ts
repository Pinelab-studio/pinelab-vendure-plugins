import { ID, Injector, RequestContext } from '@vendure/core';
import { IsNull } from 'typeorm';
import { assignProductsInBatch } from './batch-assign-products';

export async function assignAllProductsToChannel(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext,
  batch: number = 10
): Promise<void> {
  await assignProductsInBatch(
    targetChannelId,
    {
      channels: { id: sourceChannelId },
      deletedAt: IsNull(),
    },
    injector,
    ctx,
    batch
  );
}
