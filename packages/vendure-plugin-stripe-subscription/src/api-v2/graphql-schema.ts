import { gql } from 'graphql-tag';

/**
 * Needed for gql codegen
 */
const _codegenAdditions = gql`
  scalar DateTime
  scalar JSON
`;

export const shopSchemaExtensions = gql`
  union StripeSubscription =
      StripeSubscriptionOneTimePayment
    | StripeSubscriptionRecurringPayment
    | StripeSubscriptionBothPaymentTypes

  enum StripeSubscriptionInterval {
    week
    month
    year
  }

  type StripeSubscriptionBothPaymentTypes {
    priceIncludesTax: Boolean!
    amountDueNow: Int!
    recurring: StripeSubscriptionRecurringPaymentDefinition!
  }

  type StripeSubscriptionOneTimePayment {
    priceIncludesTax: Boolean!
    amountDueNow: Int!
  }

  type StripeSubscriptionRecurringPayment {
    priceIncludesTax: Boolean!
    recurring: StripeSubscriptionRecurringPaymentDefinition!
  }

  type StripeSubscriptionRecurringPaymentDefinition {
    amount: Int!
    interval: StripeSubscriptionInterval
    intervalCount: Int!
    startDate: DateTime
  }

  enum StripeSubscriptionIntentType {
    PaymentIntent
    SetupIntent
  }

  type StripeSubscriptionIntent {
    clientSecret: String!
    intentType: StripeSubscriptionIntentType!
  }

  extend type PaymentMethodQuote {
    stripeSubscriptionPublishableKey: String
  }

  extend type Query {
    previewStripeSubscription(
      productVariantId: ID!
      customInputs: JSON
    ): StripeSubscription!
    previewStripeSubscriptionForProduct(productId: ID!): [StripeSubscription!]!
  }

  extend type Mutation {
    createStripeSubscriptionIntent: String!
  }
`;
