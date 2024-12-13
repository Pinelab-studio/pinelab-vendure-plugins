import { Order, RequestContext, VendureEvent } from '@vendure/core';

/**
 * Event indicating that a checkout has started for this order
 */
export class CheckoutStartedEvent extends VendureEvent {
  constructor(public ctx: RequestContext, public order: Order) {
    super();
  }
}
