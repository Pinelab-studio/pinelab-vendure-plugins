import { RequestContext, ProductVariant } from '@vendure/core';
import { DefaultSubscriptionStrategy } from '../../src';

/**
 * Wrapper around the built-int subscription strategy to allow testing
 */
export class DefaultStrategyTestWrapper extends DefaultSubscriptionStrategy {
  isSubscription(ctx: RequestContext, variant: ProductVariant): boolean {
    // Treat variant 2 as non-subscription
    if (variant.id === 2) {
      return false;
    } else {
      return true;
    }
  }
}
