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
  Customer,
  EntityHydrator,
  OrderLine,
  Permission,
  RequestContext,
} from '@vendure/core';
import {
  AcceptBlueCheckPaymentMethod,
  AcceptBluePaymentMethod,
} from '../types';
import { AcceptBlueService } from '../service/accept-blue-service';
import {
  AcceptBluePaymentMethodQuote,
  AcceptBlueSubscription,
  AcceptBlueSurcharges,
  Query as GraphqlQuery,
  MutationUpdateAcceptBlueCardPaymentMethodArgs,
  QueryPreviewAcceptBlueSubscriptionsArgs,
  QueryPreviewAcceptBlueSubscriptionsForProductArgs,
  AcceptBlueCardPaymentMethod,
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

  @ResolveField('acceptBlueHostedTokenizationKey')
  @Resolver('PaymentMethodQuote')
  async acceptBlueHostedTokenizationKey(
    @Parent() quote: PaymentMethodQuote,
    @Ctx() ctx: RequestContext
  ): Promise<string | null | undefined> {
    return (await this.acceptBlueService.getStorefrontKeys(ctx, quote.id))
      ?.acceptBlueHostedTokenizationKey;
  }

  @ResolveField('acceptBlueTestMode')
  @Resolver('PaymentMethodQuote')
  async testMode(
    @Parent() quote: PaymentMethodQuote,
    @Ctx() ctx: RequestContext
  ): Promise<boolean | undefined> {
    return (await this.acceptBlueService.getStorefrontKeys(ctx, quote.id))
      ?.acceptBlueTestMode;
  }

  @ResolveField('acceptBlueGooglePayMerchantId')
  @Resolver('PaymentMethodQuote')
  async acceptBlueGooglePayMerchantId(
    @Parent() quote: PaymentMethodQuote,
    @Ctx() ctx: RequestContext
  ): Promise<string | null | undefined> {
    return (await this.acceptBlueService.getStorefrontKeys(ctx, quote.id))
      ?.acceptBlueGooglePayMerchantId;
  }

  @ResolveField('acceptBlueGooglePayGatewayMerchantId')
  @Resolver('PaymentMethodQuote')
  async acceptBlueGooglePayGatewayMerchantId(
    @Parent() quote: PaymentMethodQuote,
    @Ctx() ctx: RequestContext
  ): Promise<string | null | undefined> {
    return (await this.acceptBlueService.getStorefrontKeys(ctx, quote.id))
      ?.acceptBlueGooglePayGatewayMerchantId;
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

  @Query()
  async eligibleAcceptBluePaymentMethods(
    @Ctx() ctx: RequestContext
  ): Promise<AcceptBluePaymentMethodQuote[]> {
    return this.acceptBlueService.getEligiblePaymentMethods(ctx);
  }

  @Query()
  async acceptBlueSurcharges(
    @Ctx() ctx: RequestContext
  ): Promise<AcceptBlueSurcharges> {
    return await this.acceptBlueService.getSurcharges(ctx);
  }

  @Mutation()
  @Allow(Permission.UpdateCustomer, Permission.Authenticated)
  async updateAcceptBlueCardPaymentMethod(
    @Ctx() ctx: RequestContext,
    @Args()
    { input }: MutationUpdateAcceptBlueCardPaymentMethodArgs
  ): Promise<AcceptBlueCardPaymentMethod> {
    return await this.acceptBlueService.updateCardPaymentMethod(ctx, input);
  }
}
