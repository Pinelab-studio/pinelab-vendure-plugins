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
    transactions: [AcceptBlueTransaction!]!
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

  type AcceptBlueTransaction {
    id: ID!
    createdAt: DateTime!
    settledAt: DateTime
    amount: Int!
    status: String!
    errorCode: String
    errorMessage: String
    checkDetails: AcceptBlueCheckDetails
    cardDetails: AcceptBlueCardDetails
  }

  type AcceptBlueCheckDetails {
    name: String!
    routingNumber: String!
    last4: String!
  }

  type AcceptBlueCardDetails {
    name: String!
    last4: String!
    expiryMonth: Int!
    expiryYear: Int!
    cardType: String!
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

  extend type Mutation {
    refundAcceptBlueTransaction(
      transactionId: Int!
      amount: Int
      cvv2: String
    ): [AcceptBlueSubscription!]!
  }
`;
