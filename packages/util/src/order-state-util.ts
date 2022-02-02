import {
  FulfillmentStateTransitionError,
  Order,
  OrderService,
  OrderStateTransitionError,
  RequestContext,
} from '@vendure/core';
import { ConfigurableOperationInput } from '@vendure/common/lib/generated-types';

export async function fulfillOrder(
  orderService: OrderService,
  ctx: RequestContext,
  order: Order,
  handler: ConfigurableOperationInput
): Promise<Order> {
  console.error('====================', order.lines);
  const fulfillment = await orderService.createFulfillment(ctx, {
    handler,
    lines: order.lines.map((line) => ({
      orderLineId: line.id,
      quantity: line.quantity,
    })),
  });
  console.error('====================', fulfillment);
  const result = await orderService.transitionFulfillmentToState(
    ctx,
    (fulfillment as any).id,
    'Shipped'
  );
  console.error('====================resss', result);
  throwIfTransitionFailed(result as FulfillmentStateTransitionError);
  return (await orderService.findOne(ctx, order.id))!;
}

export async function transitionToShipped(
  orderService: OrderService,
  ctx: RequestContext,
  order: Order
): Promise<Order> {
  const result = await orderService.transitionToState(ctx, order.id, 'Shipped');
  throwIfTransitionFailed(result as OrderStateTransitionError);
  return order;
}

export async function transitionToDelivered(
  orderService: OrderService,
  ctx: RequestContext,
  order: Order
): Promise<Order> {
  const result = await orderService.transitionToState(
    ctx,
    order.id,
    'Delivered'
  );
  throwIfTransitionFailed(result as OrderStateTransitionError);
  return result as Order;
}

function throwIfTransitionFailed(
  result: OrderStateTransitionError | FulfillmentStateTransitionError
): void {
  if (result.transitionError || result.errorCode) {
    throw Error(
      `${result.message} - ${result.transitionError} - from ${result.fromState} - to ${result.toState}`
    );
  }
}
