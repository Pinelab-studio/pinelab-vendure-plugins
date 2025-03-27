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
  injector: Injector;
  constructor(
    private loggerCtx: string,
    private moduleRef: ModuleRef,
    private productVariantService: ProductVariantService,
    private strategy: SubscriptionStrategy
  ) {
    this.injector = new Injector(moduleRef);
  }

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

    if (!(await this.strategy.isSubscription(ctx, variant, this.injector))) {
      return [];
    }
    const subscriptions = await this.strategy.previewSubscription(
      ctx,
      this.injector,
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
    // Only define subscriptions for orderlines with a subscription product variant
    const subscriptionOrderLines = await this.getSubscriptionOrderLines(
      ctx,
      order
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

  async hasSubscriptions(ctx: RequestContext, order: Order): Promise<boolean> {
    const subscriptionOrderLines = await this.getSubscriptionOrderLines(
      ctx,
      order
    );
    return subscriptionOrderLines.length > 0;
  }

  /**
   * Gets the order lines which contain subscription products.
   * Does not create or mutate anything
   */
  async getSubscriptionOrderLines(
    ctx: RequestContext,
    order: Order
  ): Promise<OrderLine[]> {
    const subscriptionOrderLines: OrderLine[] = [];
    await Promise.all(
      order.lines.map(async (l) => {
        if (
          await this.strategy.isSubscription(
            ctx,
            l.productVariant,
            new Injector(this.moduleRef)
          )
        ) {
          subscriptionOrderLines.push(l);
        }
      })
    );
    return subscriptionOrderLines;
  }

  /**
   * Get subscriptions for a single order line
   */
  async getSubscriptionsForOrderLine(
    ctx: RequestContext,
    orderLine: OrderLine,
    order: Order
  ): Promise<Subscription[]> {
    if (!(await this.isSubscription(ctx, orderLine.productVariant))) {
      return [];
    }
    const subs = await this.strategy.defineSubscription(
      ctx,
      this.injector,
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

  async isSubscription(
    ctx: RequestContext,
    variant: ProductVariant
  ): Promise<boolean> {
    return this.strategy.isSubscription(ctx, variant, this.injector);
  }

  defineSubscription(
    ctx: RequestContext,
    productVariant: ProductVariant,
    order: Order,
    orderLineCustomFields: { [key: string]: any },
    quantity: number
  ):
    | Promise<Subscription>
    | Subscription
    | Promise<Subscription[]>
    | Subscription[] {
    return this.strategy.defineSubscription(
      ctx,
      this.injector,
      productVariant,
      order,
      orderLineCustomFields,
      quantity
    );
  }
}
