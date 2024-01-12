import { Resolver, Query, ResolveField, Parent, Args } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  OrderLine,
  Permission,
  RequestContext,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { AcceptBlueService } from './accept-blue-service';
import {
  QueryPreviewAcceptBlueSubscriptionsArgs,
  Query as GraphqlQuery,
  QueryPreviewAcceptBlueSubscriptionsForProductArgs,
  AcceptBlueSubscription,
} from './generated/graphql';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for gql codegen
const _codegenAdditions = gql`
  scalar DateTime
  scalar JSON
`;

export const shopApiExtensions = gql`
  enum AcceptBlueSubscriptionInterval {
    week
    month
    year
  }

  type AcceptBlueSubscription {
    name: String!
    variantId: ID!
    amountDueNow: Int!
    priceIncludesTax: Boolean!
    recurring: AcceptBlueSubscriptionRecurringPayment!
  }

  type AcceptBlueSubscriptionRecurringPayment {
    amount: Int!
    interval: AcceptBlueSubscriptionInterval!
    intervalCount: Int!
    startDate: DateTime!
    endDate: DateTime
  }

  type AcceptBluePaymentMethod {
    id: ID!
    created_at: DateTime!
    avs_address: String
    avs_zip: String
    name: String
    expiry_month: Int!
    expiry_year: Int!
    payment_method_type: String
    card_type: String
    last4: String
  }

  extend type PaymentMethodQuote {
    acceptBlueHostedTokenizationKey: String
  }

  extend type OrderLine {
    acceptBlueSubscriptions: [AcceptBlueSubscription!]
  }

  extend type Query {
    previewAcceptBlueSubscriptions(
      productVariantId: ID!
      customInputs: JSON
    ): [AcceptBlueSubscription!]!
    previewAcceptBlueSubscriptionsForProduct(
      productId: ID!
      customInputs: JSON
    ): [AcceptBlueSubscription!]!
    acceptBluePaymentMethods: [AcceptBluePaymentMethod!]!
  }
`;

@Resolver()
export class AcceptBlueResolver {
  constructor(private readonly acceptBlueService: AcceptBlueService) {}

  @Query()
  async previewAcceptBlueSubscriptions(
    @Ctx() ctx: RequestContext,
    @Args()
    { productVariantId, customInputs }: QueryPreviewAcceptBlueSubscriptionsArgs
  ): Promise<GraphqlQuery['previewAcceptBlueSubscriptions']> {
    return await this.acceptBlueService.subscriptionHelper.previewSubscription(
      ctx,
      productVariantId,
      customInputs
    );
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
    return await this.acceptBlueService.subscriptionHelper.previewSubscriptionsForProduct(
      ctx,
      productId,
      customInputs
    );
  }

  @Query()
  @Allow(Permission.Authenticated)
  async acceptBluePaymentMethods(
    @Ctx() ctx: RequestContext
  ): Promise<GraphqlQuery['acceptBluePaymentMethods']> {
    return await this.acceptBlueService.getPaymentMethods(ctx);
  }

  @ResolveField('acceptBlueHostedTokenizationKey')
  @Resolver('PaymentMethodQuote')
  async acceptBlueHostedTokenizationKey(
    @Ctx() ctx: RequestContext
  ): Promise<string | null> {
    return await this.acceptBlueService.getHostedTokenizationKey(ctx);
  }

  @ResolveField('acceptBlueSubscriptions')
  @Resolver('OrderLine')
  async stripeSubscriptions(
    @Ctx() ctx: RequestContext,
    @Parent() orderLine: OrderLine
  ): Promise<AcceptBlueSubscription[] | undefined> {
    // TODO place in service
    return undefined;

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
  }
}
