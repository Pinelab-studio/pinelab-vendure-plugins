import { ID, Injector, RequestContext } from '@vendure/core';
import { In } from 'typeorm';
import { IsNull } from 'typeorm';
import { assignProductsInBatch } from './batch-assign-products';

export async function assignProductsToChannel(
  targetChannelId: ID,
  injector: Injector,
  productIds: ID[],
  ctx: RequestContext,
  batch: number = 10
): Promise<void> {
  await assignProductsInBatch(
    targetChannelId,
    {
      id: In(productIds),
      deletedAt: IsNull(),
    },
    injector,
    ctx,
    batch
  );
}
