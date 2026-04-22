import { VendureEvent, RequestContext, Order } from '@vendure/core';
import { Wallet } from '../entities/wallet.entity';

/**
 * @description
 * This event is fired once per order after all gift card wallets for that
 * order have been created.
 */
export class GiftCardWalletCreatedEvent extends VendureEvent {
  constructor(
    public readonly ctx: RequestContext,
    public readonly wallets: Wallet[],
    public readonly order: Order
  ) {
    super();
  }
}
