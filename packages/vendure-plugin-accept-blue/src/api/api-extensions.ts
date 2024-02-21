import { gql } from 'graphql-tag';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for gql codegen
const _codegenAdditions = gql`
  scalar DateTime
  scalar JSON
`;

export const commonApiExtensions = gql`
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

  type AcceptBlueCardPaymentMethod {
    id: Int!
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

  type AcceptBlueCheckPaymentMethod {
    id: Int!
    customer_id: Int
    created_at: DateTime!
    name: String
    payment_method_type: String
    last4: String
    account_number: String

    routing_number: String
    account_type: String
    sec_code: String
  }

  union AcceptBluePaymentMethod =
      AcceptBlueCardPaymentMethod
    | AcceptBlueCheckPaymentMethod

  extend type PaymentMethodQuote {
    acceptBlueHostedTokenizationKey: String
  }

  extend type OrderLine {
    acceptBlueSubscriptions: [AcceptBlueSubscription!]!
  }

  extend type Customer {
    savedAcceptBluePaymentMethods: [AcceptBluePaymentMethod!]!
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
