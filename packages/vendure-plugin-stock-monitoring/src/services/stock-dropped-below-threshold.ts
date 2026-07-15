import { RequestContext, VendureEvent } from '@vendure/core';
import { ProductVariant } from '@vendure/core';

/**
 * This event is fired when a product variant's stock level drops below its threshold after order placement.
 */
export class StockDroppedBelowThresholdEvent extends VendureEvent {
  constructor(
    public ctx: RequestContext,
    public productVariant: ProductVariant,
    public stockBeforeAdjustment: number,
    public stockAfterAdjustment: number
  ) {
    super();
  }
}
