import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { PaymentMethodQuote } from '@vendure/common/lib/generated-shop-types';
import {
  Allow,
  Ctx,
  EntityHydrator,
  OrderLine,
  PaymentMethodService,
  Permission,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { Request } from 'express';
import {
  Mutation as GraphqlMutation,
  Query as GraphqlQuery,
  QueryPreviewStripeSubscriptionsArgs,
  QueryPreviewStripeSubscriptionsForProductArgs,
  StripeSubscription,
} from './generated/graphql';
import { StripeSubscriptionService } from './stripe-subscription.service';

export type RequestWithRawBody = Request & { rawBody: any };

// Resolver for both Shop and Admin API
@Resolver()
export class StripeSubscriptionCommonResolver {
  constructor(
    private stripeSubscriptionService: StripeSubscriptionService,
    private paymentMethodService: PaymentMethodService,
    private entityHydrator: EntityHydrator
  ) {}

  @Mutation()
  @Allow(Permission.Owner)
  async createStripeSubscriptionIntent(
    @Ctx() ctx: RequestContext
  ): Promise<GraphqlMutation['createStripeSubscriptionIntent']> {
    const res = await this.stripeSubscriptionService.createIntent(ctx);
    return res;
  }

  @Query()
  async previewStripeSubscriptions(
    @Ctx() ctx: RequestContext,
    @Args()
    { productVariantId, customInputs }: QueryPreviewStripeSubscriptionsArgs
  ): Promise<GraphqlQuery['previewStripeSubscriptions']> {
    return this.stripeSubscriptionService.subscriptionHelper.previewSubscription(
      ctx,
      productVariantId,
      customInputs
    );
  }

  @Query()
  async previewStripeSubscriptionsForProduct(
    @Ctx() ctx: RequestContext,
    @Args()
    { productId, customInputs }: QueryPreviewStripeSubscriptionsForProductArgs
  ): Promise<GraphqlQuery['previewStripeSubscriptionsForProduct']> {
    return this.stripeSubscriptionService.subscriptionHelper.previewSubscriptionsForProduct(
      ctx,
      productId,
      customInputs
    );
  }

  @ResolveField('stripeSubscriptionPublishableKey')
  @Resolver('PaymentMethodQuote')
  async stripeSubscriptionPublishableKey(
    @Ctx() ctx: RequestContext,
    @Parent() paymentMethodQuote: PaymentMethodQuote
  ): Promise<string | undefined> {
    const paymentMethod = await this.paymentMethodService.findOne(
      ctx,
      paymentMethodQuote.id
    );
    if (!paymentMethod) {
      throw new UserInputError(
        `No payment method with id '${paymentMethodQuote.id}' found. Unable to resolve field"stripeSubscriptionPublishableKey"`
      );
    }
    return paymentMethod.handler.args.find((a) => a.name === 'publishableKey')
      ?.value;
  }

  @ResolveField('stripeSubscriptions')
  @Resolver('OrderLine')
  async stripeSubscriptions(
    @Ctx() ctx: RequestContext,
    @Parent() orderLine: OrderLine
  ): Promise<StripeSubscription[] | undefined> {
    await this.entityHydrator.hydrate(ctx, orderLine, { relations: ['order'] });
    const subscriptionsForOrderLine =
      await this.stripeSubscriptionService.subscriptionHelper.getSubscriptionsForOrderLine(
        ctx,
        orderLine,
        orderLine.order
      );
    return subscriptionsForOrderLine.map((s) => ({
      ...s,
      variantId: orderLine.productVariant.id,
    }));
  }
}
