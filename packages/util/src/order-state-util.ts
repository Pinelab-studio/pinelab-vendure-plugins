import {
  FulfillmentStateTransitionError,
  Order,
  OrderService,
  RequestContext,
} from '@vendure/core';
import { ConfigurableOperationInput } from '@vendure/common/lib/generated-types';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';

/**
 * Fulfills all items to shipped using transitionFulfillmentToState
 */
export async function transitionToShipped(
  orderService: OrderService,
  ctx: RequestContext,
  order: Order,
  handler: ConfigurableOperationInput
): Promise<Fulfillment> {
  const lines = order.lines.map((line) => ({
    orderLineId: line.id,
    quantity: line.quantity,
  }));
  const fulfillment = await orderService.createFulfillment(ctx, {
    handler,
    lines,
  });
  const result = await orderService.transitionFulfillmentToState(
    ctx,
    (fulfillment as any).id,
    'Shipped'
  );
  return throwIfTransitionFailed(
    `Could not transition ${order.code} to Shipped`,
    result
  );
}

/**
 * Fulfills all items to shipped, then to delivered using transitionFulfillmentToState
 */
export async function transitionToDelivered(
  orderService: OrderService,
  ctx: RequestContext,
  order: Order,
  handler: ConfigurableOperationInput
): Promise<Fulfillment> {
  const fulfillment = await transitionToShipped(
    orderService,
    ctx,
    order,
    handler
  );
  const result = await orderService.transitionFulfillmentToState(
    ctx,
    (fulfillment as any).id,
    'Delivered'
  );
  return throwIfTransitionFailed(
    `Could not transition ${order.code} to Delivered`,
    result
  );
}

function throwIfTransitionFailed(
  message: string,
  result: FulfillmentStateTransitionError | Fulfillment
): Fulfillment {
  const errorResult = result as FulfillmentStateTransitionError;
  if (errorResult.transitionError || errorResult.errorCode) {
    throw Error(
      `${message}: ${errorResult.message} - from ${errorResult.fromState} to ${errorResult.toState} - ${errorResult.transitionError}`
    );
  }
  // We know its a fulfillment here
  return result as Fulfillment;
}
