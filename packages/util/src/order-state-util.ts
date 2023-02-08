import {
  ErrorResult,
  FulfillmentStateTransitionError,
  Order,
  OrderService,
  RequestContext,
} from '@vendure/core';
import {
  ConfigurableOperationInput,
  ItemsAlreadyFulfilledError,
} from '@vendure/common/lib/generated-types';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';

/**
 * Create a fulfillment for all orderlines. Returns fulfillments[0] if already fulfilled
 */
export async function fulfillAll(
  ctx: RequestContext,
  orderService: OrderService,
  order: Order,
  handler: ConfigurableOperationInput
) {
  const lines = order.lines.map((line) => ({
    orderLineId: line.id,
    quantity: line.quantity,
  }));
  const fulfillment = await orderService.createFulfillment(ctx, {
    handler,
    lines,
  });
  if (
    (fulfillment as ItemsAlreadyFulfilledError).errorCode ===
    'ITEMS_ALREADY_FULFILLED_ERROR'
  ) {
    const fulfillments = await orderService.getOrderFulfillments(ctx, order);
    return fulfillments[0];
  }
  throwIfTransitionFailed(fulfillment);
  return fulfillment as Fulfillment;
}

/**
 * Fulfills all items to shipped using transitionFulfillmentToState
 */
export async function transitionToShipped(
  orderService: OrderService,
  ctx: RequestContext,
  order: Order,
  handler: ConfigurableOperationInput
): Promise<Fulfillment> {
  const fulfillment = await fulfillAll(ctx, orderService, order, handler);
  const result = await orderService.transitionFulfillmentToState(
    ctx,
    (fulfillment as any).id,
    'Shipped'
  );
  throwIfTransitionFailed(result);
  return result as Fulfillment;
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
  throwIfTransitionFailed(result);
  return result as Fulfillment;
}

function throwIfTransitionFailed(result: any): void {
  const stateError = result as FulfillmentStateTransitionError;
  if (stateError.transitionError) {
    if (stateError.fromState === stateError.toState) {
      return; // If already 'Shipped', don't count this as an error
    }
    throw Error(
      `${stateError.message} - from ${stateError.fromState} to ${stateError.toState} - ${stateError.transitionError}`
    );
  }
  // It's not a stateTransition error
  const error = result as ErrorResult;
  if (error.errorCode) {
    throw Error(`${error.errorCode}: ${error.message}`);
  }
}
