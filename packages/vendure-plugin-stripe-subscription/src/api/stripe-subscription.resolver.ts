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
  ProductPriceApplicator,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { Request } from 'express';
import {
  Mutation as GraphqlShopMutation,
  Query as GraphqlQuery,
  QueryPreviewStripeSubscriptionsArgs,
  QueryPreviewStripeSubscriptionsForProductArgs,
  StripeSubscription,
} from './generated/shop-graphql';
import {
  Mutation as GraphqlAdminMutation,
  MutationCreateStripeSubscriptionIntentArgs,
} from './generated/admin-graphql';
import { StripeSubscriptionService } from './stripe-subscription.service';

export type RequestWithRawBody = Request & { rawBody: any };

// Resolver for both Shop and Admin API
@Resolver()
export class StripeSubscriptionCommonResolver {
  constructor(
    private stripeSubscriptionService: StripeSubscriptionService,
    private paymentMethodService: PaymentMethodService,
    private entityHydrator: EntityHydrator,
    private productPriceApplicator: ProductPriceApplicator
  ) {}

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
    return paymentMethod?.handler.args.find((a) => a.name === 'publishableKey')
      ?.value;
  }

  @ResolveField('stripeSubscriptions')
  @Resolver('OrderLine')
  async stripeSubscriptions(
    @Ctx() ctx: RequestContext,
    @Parent() orderLine: OrderLine
  ): Promise<StripeSubscription[] | undefined> {
    await this.entityHydrator.hydrate(ctx, orderLine, {
      relations: ['order', 'productVariant'],
    });
    await this.entityHydrator.hydrate(ctx, orderLine.productVariant, {
      relations: ['productVariantPrices', 'taxCategory'],
    });
    await this.productPriceApplicator.applyChannelPriceAndTax(
      orderLine.productVariant,
      ctx,
      orderLine.order
    );
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

@Resolver()
export class StripeSubscriptionShopApiResolver {
  constructor(private stripeSubscriptionService: StripeSubscriptionService) {}

  @Mutation()
  @Allow(Permission.Owner)
  async createStripeSubscriptionIntent(
    @Ctx() ctx: RequestContext
  ): Promise<GraphqlShopMutation['createStripeSubscriptionIntent']> {
    const stripePaymentMethods = ['card']; // TODO make configurable per channel
    const setupFutureUsage = 'off_session'; // TODO make configurable per channel
    const res = await this.stripeSubscriptionService.createIntent(
      ctx,
      stripePaymentMethods,
      setupFutureUsage
    );
    return res;
  }
}

@Resolver()
export class StripeSubscriptionAdminApiResolver {
  constructor(private stripeSubscriptionService: StripeSubscriptionService) {}

  @Mutation()
  @Allow(Permission.Owner)
  async createStripeSubscriptionIntent(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationCreateStripeSubscriptionIntentArgs
  ): Promise<GraphqlAdminMutation['createStripeSubscriptionIntent']> {
    const stripePaymentMethods = ['card']; // TODO make configurable per channel
    const setupFutureUsage = 'off_session'; // TODO make configurable per channel
    const res = await this.stripeSubscriptionService.createIntentForDraftOrder(
      ctx,
      args.orderId,
      stripePaymentMethods,
      setupFutureUsage
    );
    return res;
  }
}
