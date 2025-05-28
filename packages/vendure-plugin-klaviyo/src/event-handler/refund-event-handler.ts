import {
  assertFound,
  Logger,
  OrderService,
  Payment,
  RefundEvent,
} from '@vendure/core';
import { loggerCtx } from '../constants';
import {
  KlaviyoEventHandler,
  KlaviyoGenericEvent,
} from './klaviyo-event-handler';

export interface RefundEventInput {
  getPaymentMethodName: (payment: Payment | undefined) => string;
}

/**
 * Sends an event to Klavyio when a refund has been created for an order.
 */
export function createRefundHandler(
  input: RefundEventInput
): KlaviyoEventHandler<RefundEvent> {
  return {
    vendureEvent: RefundEvent,
    mapToKlaviyoEvent: async ({ ctx, order: _order, refund }, injector) => {
      const hydratedOrder = await assertFound(
        injector
          .get(OrderService)
          .findOne(ctx, _order.id, ['customer', 'payments'])
      );
      if (!hydratedOrder.customer?.emailAddress) {
        return false;
      }
      const address = hydratedOrder.billingAddress?.streetLine1
        ? hydratedOrder.billingAddress
        : hydratedOrder.shippingAddress;
      const paymentToRefund = hydratedOrder.payments.find(
        (p) => p.id === refund.paymentId
      );
      const paymentMethodName = input.getPaymentMethodName(paymentToRefund);
      const event: KlaviyoGenericEvent = {
        eventName: 'Refund Created',
        uniqueId: hydratedOrder.code,
        customProperties: {
          orderCode: hydratedOrder.code,
          paymentMethodName,
          refundReason: refund.reason,
          refundAmount: refund.total,
        },
        profile: {
          emailAddress: hydratedOrder.customer.emailAddress,
          externalId: hydratedOrder.customer.id.toString(),
          firstName: hydratedOrder.customer.firstName,
          lastName: hydratedOrder.customer.lastName,
          phoneNumber: hydratedOrder.customer.phoneNumber,
          address: {
            address1: address?.streetLine1,
            address2: address?.streetLine2,
            city: address?.city,
            postalCode: address?.postalCode,
            countryCode: address.countryCode,
          },
        },
      };
      Logger.info(
        `Sent '${event.eventName}' to Klaviyo for order ${hydratedOrder.code}`,
        loggerCtx
      );
      return event;
    },
  };
}
