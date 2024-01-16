import {
  ErrorResult,
  FulfillmentStateTransitionError,
  Order,
  OrderService,
  RequestContext,
} from '@vendure/core';
import {
  AddFulfillmentToOrderResult,
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
): Promise<Fulfillment> {
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
): Promise<Fulfillment | FulfillmentStateTransitionError> {
  const fulfillment = await fulfillAll(ctx, orderService, order, handler);
  const result = await orderService.transitionFulfillmentToState(
    ctx,
    fulfillment.id,
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
): Promise<(Fulfillment | FulfillmentStateTransitionError)[]> {
  const shippedResult = await transitionToShipped(
    orderService,
    ctx,
    order,
    handler
  );
  let fulfillments: Fulfillment[] = [];
  if ((shippedResult as FulfillmentStateTransitionError).errorCode) {
    fulfillments = await orderService.getOrderFulfillments(ctx, order);
  } else {
    // if not an error, shippedResult is the only fulfillment
    fulfillments.push(shippedResult as Fulfillment);
  }
  const results: (Fulfillment | FulfillmentStateTransitionError)[] = [];
  for (const fulfillment of fulfillments) {
    const result = await orderService.transitionFulfillmentToState(
      ctx,
      fulfillment.id,
      'Delivered'
    );
    throwIfTransitionFailed(result);
    results.push(result);
  }
  return results;
}

/**
 * Throws the error result if the transition failed
 */
export function throwIfTransitionFailed(
  result:
    | FulfillmentStateTransitionError
    | Fulfillment
    | AddFulfillmentToOrderResult
): void {
  const stateError = result as FulfillmentStateTransitionError;
  if (
    stateError.transitionError &&
    stateError.fromState === stateError.toState
  ) {
    return; // If already 'Shipped', don't count this as an error
  }
  // It's not a stateTransition error
  const error = result as ErrorResult;
  if (error.errorCode) {
    throw error;
  }
}
