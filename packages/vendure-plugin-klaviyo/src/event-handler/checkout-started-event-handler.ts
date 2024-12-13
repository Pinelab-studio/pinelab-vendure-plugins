import {
  KlaviyoEventHandler,
  KlaviyoGenericEvent,
} from '../event-handler/klaviyo-event-handler';
import { EntityHydrator, Logger } from '@vendure/core';
import { CheckoutStartedEvent } from '../service/checkout-started-event';
import { loggerCtx } from '../constants';

/**
 * Sends an event to Klavyio when a checkout has started and the order has a customer email address.
 */
export const startedCheckoutHandler: KlaviyoEventHandler<CheckoutStartedEvent> =
  {
    vendureEvent: CheckoutStartedEvent,
    mapToKlaviyoEvent: async ({ ctx, order }, injector) => {
      await injector.get(EntityHydrator).hydrate(ctx, order, {
        relations: ['customer', 'lines.productVariant'],
      });
      if (!order.customer?.emailAddress) {
        return false;
      }
      const address = order.billingAddress?.streetLine1
        ? order.billingAddress
        : order.shippingAddress;
      const event: KlaviyoGenericEvent = {
        eventName: 'Checkout Started',
        uniqueId: order.code,
        customProperties: {
          orderCode: order.code,
          orderItems: order.lines.map((line) => ({
            productName: line.productVariant.name,
            quantity: line.quantity,
          })),
        },
        profile: {
          emailAddress: order.customer.emailAddress,
          externalId: order.customer.id.toString(),
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          phoneNumber: order.customer.phoneNumber,
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
        `Sent '${event.eventName}' to Klaviyo for order ${order.code}`,
        loggerCtx
      );
      return event;
    },
  };
