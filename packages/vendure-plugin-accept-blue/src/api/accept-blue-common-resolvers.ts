import {
  Args,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Mutation,
} from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Customer,
  EntityHydrator,
  OrderLine,
  Permission,
  RequestContext,
} from '@vendure/core';
import {
  AcceptBlueCardPaymentMethod,
  AcceptBlueCheckPaymentMethod,
  AcceptBluePaymentMethod,
} from '../types';
import { AcceptBlueService } from './accept-blue-service';
import {
  AcceptBlueSubscription,
  Query as GraphqlQuery,
  Mutation as GraphqlMutation,
  QueryPreviewAcceptBlueSubscriptionsArgs,
  QueryPreviewAcceptBlueSubscriptionsForProductArgs,
  MutationRefundAcceptBlueTransactionArgs,
} from './generated/graphql';

@Resolver()
export class AcceptBlueCommonResolver {
  constructor(
    private readonly acceptBlueService: AcceptBlueService,
    private entityHydrator: EntityHydrator
  ) {}

  @Query()
  async previewAcceptBlueSubscriptions(
    @Ctx() ctx: RequestContext,
    @Args()
    { productVariantId, customInputs }: QueryPreviewAcceptBlueSubscriptionsArgs
  ): Promise<GraphqlQuery['previewAcceptBlueSubscriptions']> {
    const subscriptions =
      await this.acceptBlueService.subscriptionHelper.previewSubscription(
        ctx,
        productVariantId,
        customInputs
      );
    return subscriptions.map((sub) => ({
      ...sub,
      transactions: [], // No transactions exist for a preview subscription
    }));
  }

  @Query()
  async previewAcceptBlueSubscriptionsForProduct(
    @Ctx() ctx: RequestContext,
    @Args()
    {
      productId,
      customInputs,
    }: QueryPreviewAcceptBlueSubscriptionsForProductArgs
  ): Promise<GraphqlQuery['previewAcceptBlueSubscriptionsForProduct']> {
    const subscriptions =
      await this.acceptBlueService.subscriptionHelper.previewSubscriptionsForProduct(
        ctx,
        productId,
        customInputs
      );
    return subscriptions.map((sub) => ({
      ...sub,
      transactions: [], // No transactions exist for a preview subscription
    }));
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async refundAcceptBlueTransaction(
    @Ctx() ctx: RequestContext,
    @Args()
    { transactionId, amount, cvv2 }: MutationRefundAcceptBlueTransactionArgs
  ): Promise<GraphqlMutation['refundAcceptBlueTransaction']> {
    return await this.acceptBlueService.refund(
      ctx,
      transactionId,
      amount ?? undefined,
      cvv2 ?? undefined
    );
  }

  @ResolveField('acceptBlueHostedTokenizationKey')
  @Resolver('PaymentMethodQuote')
  async acceptBlueHostedTokenizationKey(
    @Ctx() ctx: RequestContext
  ): Promise<string | null> {
    return await this.acceptBlueService.getHostedTokenizationKey(ctx);
  }

  @ResolveField('savedAcceptBluePaymentMethods')
  @Resolver('Customer')
  async savedPaymentMethods(
    @Ctx() ctx: RequestContext,
    @Parent() customer: Customer
  ): Promise<AcceptBluePaymentMethod[]> {
    return await this.acceptBlueService.getSavedPaymentMethods(ctx, customer);
  }

  @ResolveField('acceptBlueSubscriptions')
  @Resolver('OrderLine')
  async acceptBlueSubscriptions(
    @Ctx() ctx: RequestContext,
    @Parent() orderLine: OrderLine
  ): Promise<AcceptBlueSubscription[]> {
    await this.entityHydrator.hydrate(ctx, orderLine, {
      relations: ['productVariant', 'order'],
    });
    return this.acceptBlueService.getSubscriptionsForOrderLine(
      ctx,
      orderLine,
      orderLine.order
    );
  }

  @ResolveField()
  @Resolver('AcceptBluePaymentMethod')
  __resolveType(
    value: AcceptBlueCheckPaymentMethod | AcceptBlueCardPaymentMethod
  ): string {
    return value.payment_method_type === 'card'
      ? 'AcceptBlueCardPaymentMethod'
      : 'AcceptBlueCheckPaymentMethod';
  }
}
