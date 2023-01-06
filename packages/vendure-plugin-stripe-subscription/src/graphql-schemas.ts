import { gql } from 'graphql-tag';

/**
 * Needed for gql codegen
 */
const _scalar = gql`
  scalar DateTime
`;

const sharedTypes = gql`
  enum SubscriptionInterval {
    week
    month
  }
  enum SubscriptionStartMoment {
    start_of_billing_interval
    end_of_billing_interval
    time_of_purchase
  }
`;

export const shopSchemaExtensions = gql`
  ${sharedTypes}

  type StripeSubscriptionPricing {
    variantId: String!
    downpayment: Int!
    totalProratedAmount: Int!
    proratedDays: Int!
    dayRate: Int!
    recurringPrice: Int!
    interval: SubscriptionInterval!
    intervalCount: Int!
    amountDueNow: Int!
    subscriptionStartDate: DateTime!
  }
  input StripeSubscriptionPricingInput {
    productVariantId: ID!
    startDate: DateTime
    downpayment: Int
  }
  extend type Query {
    """
    Preview the pricing model of a given subscription. Prices are excluding tax!
    Start date and downpayment are optional: if not supplied, the subscriptions default will be used.
    """
    stripeSubscriptionPricing(
      input: StripeSubscriptionPricingInput
    ): StripeSubscriptionPricing
    stripeSubscriptionPricingForOrderLine(
      orderLineId: ID!
    ): StripeSubscriptionPricing
    stripeSubscriptionPricingForProduct(
      productId: ID!
    ): [StripeSubscriptionPricing!]!
  }
  extend type Mutation {
    createStripeSubscriptionIntent: String!
  }
`;

export const adminSchemaExtensions = gql`
  ${sharedTypes}
  type StripeSubscriptionSchedule {
    id: ID!
    createdAt: DateTime
    updatedAt: DateTime
    name: String!
    downpayment: Int!
    durationInterval: SubscriptionInterval!
    durationCount: Int!
    startMoment: SubscriptionStartMoment!
    paidUpFront: Boolean!
    billingInterval: SubscriptionInterval!
    billingCount: Int!
  }
  extend type Query {
    stripeSubscriptionSchedules: [StripeSubscriptionSchedule!]!
  }
`;
