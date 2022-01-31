import { Order, OrderService, RequestContext } from '@vendure/core';

/**
 * Progress order to Shipped or returns false if that's not possible
 */
export async function progressToShipped(
  orderService: OrderService,
  ctx: RequestContext,
  orderCode: string
): Promise<Order | false> {
  const order = await orderService.findOneByCode(ctx, orderCode);
  if (!order) {
    throw Error(`Order ${orderCode} doesn't exist`);
  }
  const nextStates = orderService.getNextOrderStates(order);
  if (!nextStates.find((state) => state === 'Shipped')) {
    return false;
  }
  const result = await orderService.transitionToState(ctx, order.id, 'Shipped');
  if ((result as Order).state !== 'Shipped') {
    return false;
  }
  return order;
}
