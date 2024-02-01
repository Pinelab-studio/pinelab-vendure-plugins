import { gql } from 'graphql-tag';

/**
 * Needed for gql codegen
 */
const _codegenAdditions = gql`
  scalar DateTime
  scalar JSON
`;

export const commonSchemaExtensions = gql`
  enum StripeSubscriptionInterval {
    week
    month
    year
  }

  type StripeSubscription {
    name: String!
    variantId: ID!
    amountDueNow: Int!
    priceIncludesTax: Boolean!
    recurring: StripeSubscriptionRecurringPayment!
  }

  type StripeSubscriptionRecurringPayment {
    amount: Int!
    interval: StripeSubscriptionInterval!
    intervalCount: Int!
    startDate: DateTime!
    endDate: DateTime
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

  extend type OrderLine {
    """
    These subscriptions are calculated dynamically, and should not be used for historical data.
    Actual created subscriptions should be fetched from he connected Stripe account.
    """
    stripeSubscriptions: [StripeSubscription!]
  }

  extend type Query {
    previewStripeSubscriptions(
      productVariantId: ID!
      customInputs: JSON
    ): [StripeSubscription!]!
    previewStripeSubscriptionsForProduct(
      productId: ID!
      customInputs: JSON
    ): [StripeSubscription!]!
  }
`;
