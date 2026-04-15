import { RequestContext, Injector, Order, OrderLine } from '@vendure/core';

/**
 * @description
 * Configuration options for the StoreCreditPlugin.
 */
export interface StoreCreditPluginOptions {
  /**
   * @description
   * A custom hook or factory function that determines if a `Wallet` should be
   * created based on an OrderLine.
   * * Returning an object with `price` and `cardCode` will trigger the creation logic.
   * Returning `false` will skip wallet creation for that specific line item.
   * * @param ctx - The current RequestContext, useful for language or session-specific logic.
   * @param injector - The Vendure Injector, used to access other services (e.g., ProductService).
   * @param order - The complete Order entity containing the current transaction data.
   * @param orderLine - The specific line item being evaluated for gift card eligibility.
   */
  createGiftCardWallet?: (
    ctx: RequestContext,
    injector: Injector,
    order: Order,
    orderLine: OrderLine
  ) => Promise<{ price: number; cardCode: string } | false>;
}
