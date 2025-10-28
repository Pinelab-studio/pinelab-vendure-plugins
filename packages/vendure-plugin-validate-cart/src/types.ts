import { ValidateCartStrategy } from './services/validate-cart-strategy';

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface ValidateCartInitOptions {
  /**
   * Your custom validation strategy.
   */
  validationStrategy?: ValidateCartStrategy;
  /**
   * After how many milliseconds to log a warning if the cart is not validated.
   * This was added because validating a cart is a crucial step in the checkout process, and you want to be informed when validation takes too long.
   * Default is 1000ms.
   */
  logWarningAfterMs?: number;
}
