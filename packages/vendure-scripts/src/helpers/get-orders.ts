import {
  ID,
  Injector,
  Order,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';

export function getOrders(
  ctx: RequestContext,
  sourceChanneId: ID,
  injector: Injector,
  take: number = 10,
  skip: number = 0
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
