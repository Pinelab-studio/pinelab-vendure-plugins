import { RequestContext, Injector, Order, OrderLine } from '@vendure/core';

/**
 * @description
 * Configuration options for the StoreCreditPlugin.
 */
export interface StoreCreditPluginOptions {
  /**
   * @description
   * Determines if a gift card wallet should be created for a given OrderLine.
   *
   * Creates a gift card wallet when the hook returns an object with `price`
   * and `cardCode`. Returning `false` skips wallet creation for that line.
   *
   * **Important:** `cardCode` is used to authorize spending against the
   * wallet, so it must be unguessable. Always return a cryptographically
   * random value with sufficient entropy (see the plugin README for
   * guidance).
   *
   * @param ctx - The current RequestContext.
   * @param injector - The Vendure Injector, to access other services.
   * @param order - The Order that was just placed.
   * @param orderLine - The OrderLine being evaluated.
   */
  createGiftCardWallet?: (
    ctx: RequestContext,
    injector: Injector,
    order: Order,
    orderLine: OrderLine
  ) => Promise<{ price: number; cardCode: string } | false>;
}
