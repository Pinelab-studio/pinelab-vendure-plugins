import { Resolver, Query, Args } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { gql } from 'graphql-tag';
import { AcceptBlueService } from './accept-blue-service';
import {
  QueryPreviewAcceptBlueSubscriptionsArgs,
  Query as GraphqlQuery,
  QueryPreviewAcceptBlueSubscriptionsForProductArgs,
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
  }
`;

@Resolver()
export class AcceptBlueResolver {
  constructor(private readonly acceptBlueService: AcceptBlueService) {}

  @Query()
  async previewStripeSubscriptions(
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
  async previewStripeSubscriptionsForProduct(
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
}
