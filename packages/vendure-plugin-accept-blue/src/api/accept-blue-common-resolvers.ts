import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, Customer, OrderLine, RequestContext } from '@vendure/core';
import { AcceptBluePaymentMethod } from '../types';
import { AcceptBlueService } from './accept-blue-service';
import {
  AcceptBlueSubscription,
  Query as GraphqlQuery,
  QueryPreviewAcceptBlueSubscriptionsArgs,
  QueryPreviewAcceptBlueSubscriptionsForProductArgs,
} from './generated/graphql';

@Resolver()
export class AcceptBlueCommonResolver {
  constructor(private readonly acceptBlueService: AcceptBlueService) {}

  @Query()
  async previewAcceptBlueSubscriptions(
    @Ctx() ctx: RequestContext,
    @Args()
    { productVariantId, customInputs }: QueryPreviewAcceptBlueSubscriptionsArgs,
  ): Promise<GraphqlQuery['previewAcceptBlueSubscriptions']> {
    return await this.acceptBlueService.subscriptionHelper.previewSubscription(
      ctx,
      productVariantId,
      customInputs,
    );
  }

  @Query()
  async previewAcceptBlueSubscriptionsForProduct(
    @Ctx() ctx: RequestContext,
    @Args()
    {
      productId,
      customInputs,
    }: QueryPreviewAcceptBlueSubscriptionsForProductArgs,
  ): Promise<GraphqlQuery['previewAcceptBlueSubscriptionsForProduct']> {
    return await this.acceptBlueService.subscriptionHelper.previewSubscriptionsForProduct(
      ctx,
      productId,
      customInputs,
    );
  }

  @ResolveField('acceptBlueHostedTokenizationKey')
  @Resolver('PaymentMethodQuote')
  async acceptBlueHostedTokenizationKey(
    @Ctx() ctx: RequestContext,
  ): Promise<string | null> {
    return await this.acceptBlueService.getHostedTokenizationKey(ctx);
  }

  @ResolveField('savedAcceptBluePaymentMethods')
  @Resolver('Customer')
  async savedPaymentMethods(
    @Ctx() ctx: RequestContext,
    @Parent() customer: Customer,
  ): Promise<AcceptBluePaymentMethod[]> {
    return await this.acceptBlueService.getSavedPaymentMethods(ctx, customer);
  }

  @ResolveField('acceptBlueSubscriptions')
  @Resolver('OrderLine')
  async stripeSubscriptions(
    @Ctx() ctx: RequestContext,
    @Parent() orderLine: OrderLine,
  ): Promise<AcceptBlueSubscription[]> {
    // TODO place in service

    // await this.entityHydrator.hydrate(ctx, orderLine, { relations: ['order'] });
    // const subscriptionsForOrderLine =
    //   await this.stripeSubscriptionService.subscriptionHelper.getSubscriptionsForOrderLine(
    //     ctx,
    //     orderLine,
    //     orderLine.order
    //   );
    // return subscriptionsForOrderLine.map((s) => ({
    //   ...s,
    //   variantId: orderLine.productVariant.id,
    // }));
    throw new Error('Not implemented');
  }
}
