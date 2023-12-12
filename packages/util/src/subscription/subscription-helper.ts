import {
  ID,
  Injector,
  Order,
  OrderLine,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { ModuleRef } from '@nestjs/core';
import { Subscription, SubscriptionStrategy } from './subscription-strategy';

export interface SubscriptionWithVariantId extends Subscription {
  variantId: ID;
}

/**
 * Helper for payment-provider independent subscription logic
 */
export class SubscriptionHelper {
  constructor(
    private loggerCtx: string,
    private moduleRef: ModuleRef,
    private productVariantService: ProductVariantService,
    private strategy: SubscriptionStrategy
  ) {}

  async previewSubscription(
    ctx: RequestContext,
    productVariantId: ID,
    customInputs?: any
  ): Promise<SubscriptionWithVariantId[]> {
    const variant = await this.productVariantService.findOne(
      ctx,
      productVariantId
    );
    if (!variant) {
      throw new UserInputError(
        `No product variant with id '${productVariantId}' found`
      );
    }
    const injector = new Injector(this.moduleRef);
    const subscriptions = await this.strategy.previewSubscription(
      ctx,
      injector,
      variant,
      customInputs
    );
    if (Array.isArray(subscriptions)) {
      return subscriptions.map((sub) => ({
        ...sub,
        variantId: variant.id,
      }));
    } else {
      return [
        {
          ...subscriptions,
          variantId: variant.id,
        },
      ];
    }
  }

  /**
   * Preview all subscriptions for a given product
   */
  async previewSubscriptionsForProduct(
    ctx: RequestContext,
    productId: ID,
    customInputs?: any
  ): Promise<SubscriptionWithVariantId[]> {
    const { items: variants } =
      await this.productVariantService.getVariantsByProductId(ctx, productId);
    if (!variants?.length) {
      throw new UserInputError(`No variants for product '${productId}' found`);
    }
    const subscriptions = await Promise.all(
      variants.map((v) => this.previewSubscription(ctx, v.id, customInputs))
    );
    return subscriptions.flat();
  }

  /**
   * This defines the actual subscriptions and prices for each order line, based on the configured strategy.
   * Doesn't allow recurring amount to be below 0 or lower
   */
  async getSubscriptionsForOrder(
    ctx: RequestContext,
    order: Order
  ): Promise<(SubscriptionWithVariantId & { orderLineId: ID })[]> {
    const injector = new Injector(this.moduleRef);
    // Only define subscriptions for orderlines with a subscription product variant
    const subscriptionOrderLines = order.lines.filter((l) =>
      this.isSubscription(ctx, l.productVariant)
    );
    const subscriptions = await Promise.all(
      subscriptionOrderLines.map(async (line) => {
        const subs = await this.getSubscriptionsForOrderLine(ctx, line, order);
        // Add orderlineId and variantId to subscription
        return subs.map((sub) => ({
          orderLineId: line.id,
          variantId: line.productVariant.id,
          ...sub,
        }));
      })
    );
    const flattenedSubscriptionsArray = subscriptions.flat();
    // Validate recurring amount
    flattenedSubscriptionsArray.forEach((subscription) => {
      if (
        !subscription.recurring.amount ||
        subscription.recurring.amount <= 0
      ) {
        throw Error(
          `[${this.loggerCtx}]: Defined subscription for order line ${subscription.variantId} must have a recurring amount greater than 0`
        );
      }
    });
    return flattenedSubscriptionsArray;
  }

  /**
   * Get subscriptions for a single order line
   */
  async getSubscriptionsForOrderLine(
    ctx: RequestContext,
    orderLine: OrderLine,
    order: Order
  ): Promise<Subscription[]> {
    const injector = new Injector(this.moduleRef);
    const subs = await this.strategy.defineSubscription(
      ctx,
      injector,
      orderLine.productVariant,
      order,
      orderLine.customFields,
      orderLine.quantity
    );
    if (Array.isArray(subs)) {
      return subs;
    }
    return [subs];
  }

  // proxy methods to strategy

  isSubscription = this.strategy.isSubscription;
  defineSubscription = this.strategy.defineSubscription;
}
