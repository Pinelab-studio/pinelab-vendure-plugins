import {
  ID,
  Injector,
  Order,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { assignEntitiesToChannel } from './util';

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

function getOrders(
  ctx: RequestContext,
  sourceChanneId: ID,
  injector: Injector,
  skip: number = 0,
  take: number = 10
): Promise<Order[]> {
  const conn = injector.get(TransactionalConnection);
  const orderRepo = conn.getRepository(ctx, Order);
  return orderRepo
    .createQueryBuilder('order')
    .innerJoin('order.channels', 'channel')
    .select('order.id')
    .setFindOptions({ take, skip, where: { channels: { id: sourceChanneId } } })
    .getMany();
}
