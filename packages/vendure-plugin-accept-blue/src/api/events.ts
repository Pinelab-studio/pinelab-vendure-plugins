import { ID, Order, VendureEvent } from '@vendure/core';

export class TransactionEvent extends VendureEvent {
  constructor(
    public createdAt: Date,
    public data: any,
    public status: 'succeeded' | 'updated' | 'declined' | 'error' | 'status',
    public acSubscriptionId?: number,
    public orderLineId?: ID,
    public order?: Order,
    public transactionId?: number
  ) {
    super();
  }
}
