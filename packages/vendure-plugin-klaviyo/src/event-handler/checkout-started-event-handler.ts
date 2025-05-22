import {
  KlaviyoEventHandler,
  KlaviyoGenericEvent,
} from '../event-handler/klaviyo-event-handler';
import { assertFound, Logger, OrderService } from '@vendure/core';
import { CheckoutStartedEvent } from '../service/checkout-started-event';
import { loggerCtx } from '../constants';

/**
 * Sends an event to Klavyio when a checkout has started and the order has a customer email address.
 */
export const startedCheckoutHandler: KlaviyoEventHandler<CheckoutStartedEvent> =
  {
    vendureEvent: CheckoutStartedEvent,
    mapToKlaviyoEvent: async ({ ctx, order: _order }, injector) => {
      const hydratedOrder = await assertFound(
        injector
          .get(OrderService)
          .findOne(ctx, _order.id, [
            'customer',
            'lines',
            'lines.productVariant',
          ])
      );
      if (!hydratedOrder.customer?.emailAddress) {
        return false;
      }
      const address = hydratedOrder.billingAddress?.streetLine1
        ? hydratedOrder.billingAddress
        : hydratedOrder.shippingAddress;
      const event: KlaviyoGenericEvent = {
        eventName: 'Checkout Started',
        uniqueId: hydratedOrder.code,
        customProperties: {
          orderCode: hydratedOrder.code,
          orderItems: hydratedOrder.lines.map((line) => ({
            productName: line.productVariant.name,
            quantity: line.quantity,
          })),
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
