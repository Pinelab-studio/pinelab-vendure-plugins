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
   * This hook is called **once per order line item** (i.e. once per
   * quantity). For example, if an order line has a quantity of 3, the hook
   * is invoked 3 times, allowing you to return a different `price` or
   * `cardCode` for each individual gift card.
   *
   * Creates a gift card wallet when the hook returns an object with `price`
   * and `cardCode`. Returning `false` skips wallet creation for that item.
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
