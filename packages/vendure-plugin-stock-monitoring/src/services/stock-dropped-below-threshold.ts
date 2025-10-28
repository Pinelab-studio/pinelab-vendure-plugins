import { Order, RequestContext, VendureEvent } from '@vendure/core';
import { ProductVariant } from '@vendure/core';

/**
 * This event is fired when a product variant's stock level drops below its threshold after order placement.
 */
export class StockDroppedBelowThresholdEvent extends VendureEvent {
  constructor(
    public ctx: RequestContext,
    public productVariant: ProductVariant,
    public stockBeforeOrder: number,
    public stockAfterOrder: number,
    public order?: Order
  ) {
    super();
  }
}
