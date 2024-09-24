import { OrderLine, VendureEvent } from '@vendure/core';
import { AcceptBlueEvent } from '../types';

/**
 * This event is fired when a transaction is received from Accept Blue.
 */
export class AcceptBlueTransactionEvent extends VendureEvent {
  constructor(
    public status: 'succeeded' | 'updated' | 'declined' | 'error' | 'status',
    /**
     * The entire data object received from Accept Blue webhook
     */
    public rawData: AcceptBlueEvent,
    /**
     * OrderLine including the order relation
     */
    public orderLine: OrderLine,
    public transactionId?: number
  ) {
    super();
  }
}
