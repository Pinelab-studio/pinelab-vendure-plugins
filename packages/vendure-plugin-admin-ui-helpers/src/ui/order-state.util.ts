import { DataService } from '@vendure/admin-ui/core';
import {
  FulfillmentStateTransitionError,
  OrderDetailFragment,
} from '@vendure/admin-ui/core/common/generated-types';
import { ErrorResult, RefundOrderStateError } from '@vendure/core';

export async function transitionToShipped(
  dataService: DataService,
  order: OrderDetailFragment
): Promise<void> {
  const { fulfillmentHandlers } = await dataService.shippingMethod
    .getShippingMethodOperations()
    .single$.toPromise();
  const handlerCode =
    order.shippingLines[0].shippingMethod.fulfillmentHandlerCode;
  const handler = fulfillmentHandlers.find(
    (handler) => handler.code === handlerCode
  );
  if (!handler) {
    throw Error(`No handler found for ${handlerCode}`);
  }
  const args = handler.args.map((arg) => ({ name: arg.name, value: '' }));
  const { addFulfillmentToOrder } = await dataService.order
    .createFulfillment({
      handler: {
        code: handlerCode,
        arguments: args,
      },
      lines: order.lines.map((line) => ({
        quantity: line.quantity,
        orderLineId: String(line.id),
      })),
    })
    .toPromise();
  let fulfillmentId = (addFulfillmentToOrder as any).id;
  const errorResult = addFulfillmentToOrder as FulfillmentStateTransitionError;
  if (errorResult.errorCode === 'ITEMS_ALREADY_FULFILLED_ERROR') {
    fulfillmentId = order.fulfillments?.[0].id;
  } else if (errorResult.errorCode) {
    throw Error(`${errorResult.errorCode} - ${errorResult.transitionError}`);
  }
  const { transitionFulfillmentToState } = await dataService.order
    .transitionFulfillmentToState(fulfillmentId, 'Shipped')
    .toPromise();
  const transitionError =
    transitionFulfillmentToState as FulfillmentStateTransitionError;
  if (transitionError.errorCode) {
    throw Error(`${errorResult.errorCode} - ${errorResult.transitionError}`);
  }
}

export async function transitionToDelivered(
  dataService: DataService,
  order: OrderDetailFragment
): Promise<void> {
  const fulfillmentId = order.fulfillments?.[0].id;
  const { transitionFulfillmentToState } = await dataService.order
    .transitionFulfillmentToState(fulfillmentId!, 'Delivered')
    .toPromise();
  const transitionError =
    transitionFulfillmentToState as FulfillmentStateTransitionError;
  if (transitionError.errorCode?.indexOf('"Delivered" to "Delivered"') > -1) {
    // this is ok
  } else if (transitionError.errorCode) {
    throw Error(
      `${transitionError.errorCode} - ${transitionError.transitionError}`
    );
  }
}

export async function refund(
  dataService: DataService,
  order: OrderDetailFragment
): Promise<void> {
  let lines = order.lines.map((line) => ({
    quantity: line.quantity,
    orderLineId: String(line.id),
  }));
  if (order.state === 'AddingItems') {
    lines = [];
  }
  const { refundOrder } = await dataService.order
    .refundOrder({
      lines,
      reason: 'Manual refund',
      paymentId: order.payments![0].id,
      adjustment: 0,
      shipping: order.shipping,
    })
    .toPromise();
  const errorResult = refundOrder as RefundOrderStateError;
  if (errorResult.errorCode) {
    throw Error(`${errorResult.errorCode} - ${errorResult.orderState}`);
  }
}

export async function cancel(
  dataService: DataService,
  order: OrderDetailFragment
): Promise<void> {
  const { cancelOrder } = await dataService.order
    .cancelOrder({
      lines: order.lines.map((line) => ({
        quantity: line.quantity,
        orderLineId: String(line.id),
      })),
      reason: 'Manual cancel',
      orderId: order.id,
      cancelShipping: true,
    })
    .toPromise();
  const errorResult = cancelOrder as ErrorResult;
  if (errorResult.errorCode) {
    throw Error(`${errorResult.errorCode} - ${errorResult.message}`);
  }
}
