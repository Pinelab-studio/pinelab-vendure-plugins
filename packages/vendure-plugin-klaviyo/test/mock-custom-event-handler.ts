import { OrderPlacedEvent } from '@vendure/core';
import { KlaviyoEventHandler, KlaviyoGenericEvent } from '../src';

/**
 * Testing if a custom event can be sent to Klaviyo
 */
export const mockCustomEventHandler: KlaviyoEventHandler<OrderPlacedEvent> = {
  vendureEvent: OrderPlacedEvent,
  mapToKlaviyoEvent: async ({ order, ctx }, injector) => {
    if (!order.customer) {
      return false;
    }
    return <KlaviyoGenericEvent>{
      eventName: 'Custom Testing Event',
      uniqueId: order.code,
      profile: {
        emailAddress: order.customer.emailAddress,
        externalId: order.customer.id.toString(),
        firstName: order.customer.firstName,
        lastName: order.customer.lastName,
        phoneNumber: order.customer.phoneNumber,
        address: {},
      },
      customProperties: {
        customTestEventProp: 'some information',
      },
    };
  },
};
