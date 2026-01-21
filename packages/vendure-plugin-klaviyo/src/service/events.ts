import { Order, RequestContext, VendureEvent } from '@vendure/core';
import { KlaviyoGenericEvent } from '../event-handler/klaviyo-event-handler';

/**
 * Event indicating that a checkout has started for this order
 */
export class CheckoutStartedEvent extends VendureEvent {
  constructor(public ctx: RequestContext, public order: Order) {
    super();
  }
}

/**
 * This event is fired when a Klaviyo event fails to be sent to Klaviyo.
 */
export class FailedToSendToKlaviyoEvent extends VendureEvent {
  constructor(
    public ctx: RequestContext,
    /**
     * The data of the Klaviyo event that failed. This contains the event name, profile and any custom properties.
     */
    public data: KlaviyoGenericEvent,
    /**
     * The error that was thrown when sending the Klaviyo event.
     */
    public error: unknown
  ) {
    super();
  }
}
