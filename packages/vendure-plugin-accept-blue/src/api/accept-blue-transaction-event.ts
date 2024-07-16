import { OrderLine, VendureEvent } from '@vendure/core';
import { AcceptBlueEvent } from '../types';

/**
 * 
 */
export class AcceptBlueTransactionEvent extends VendureEvent {
  constructor(
    public status: 'succeeded' | 'updated' | 'declined' | 'error' | 'status',
    /**
     * The entire data object received from Accept Blue webhook
     */
    public rawData: AcceptBlueEvent,
    public transactionId?: number,
    /**
     * OrderLine including the order relation. Only defined when the plugin can connect the transaction to an orderLine
     */
    public orderLine?: OrderLine,
  ) {
    super();
  }
}
