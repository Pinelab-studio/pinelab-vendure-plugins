import { ID, Injector, Order, RequestContext } from '@vendure/core';
import { getOrders } from '../helpers/get-orders';
import { assignEntitiesToChannel } from '../helpers/assign-entity-to-channel';
export async function assignOrdersToChannel(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext,
  batch: number = 10
): Promise<void> {
  await assignEntitiesToChannel<Order>(
    sourceChannelId,
    targetChannelId,
    injector,
    ctx,
    getOrders,
    batch
  );
}
