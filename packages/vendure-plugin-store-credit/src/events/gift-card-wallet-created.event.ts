import { VendureEvent, RequestContext, Order } from '@vendure/core';
import { Wallet } from '../entities/wallet.entity';

/**
 * @description
 * This event is fired whenever a new GiftCardWallet is created,
 * typically during the checkout process or via administrative action.
 */
export class GiftCardWalletCreatedEvent extends VendureEvent {
  constructor(
    public readonly ctx: RequestContext,
    public readonly wallet: Wallet,
    public readonly order?: Order
  ) {
    super();
  }
}
