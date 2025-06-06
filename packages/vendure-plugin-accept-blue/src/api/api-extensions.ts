import { gql } from 'graphql-tag';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for gql codegen
const _codegenAdditions = gql`
  scalar DateTime
  scalar JSON
`;

const commonApiExtensions = gql`
  enum AcceptBlueSubscriptionInterval {
    week
    month
    year
  }

  type AcceptBlueSubscription {
    """
    This ID might not be available yet when an order hasn't been placed yet
    """
    id: ID
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
    createdAt: DateTime
    startDate: DateTime
    nextRunDate: DateTime
    previousRunDate: DateTime
    numLeft: Int
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

  enum AcceptBlueRefundStatus {
    Approved
    PartiallyApproved
    Declined
    Error
  }

  type AcceptBlueRefundResult {
    referenceNumber: Int!
    version: String!
    status: AcceptBlueRefundStatus!
    errorMessage: String
    errorCode: String
    errorDetails: String
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
    acceptBlueGooglePayMerchantId: String
    acceptBlueGooglePayGatewayMerchantId: String
    acceptBlueTestMode: Boolean
  }

  extend type OrderLine {
    acceptBlueSubscriptions: [AcceptBlueSubscription!]!
  }

  extend type Customer {
    savedAcceptBluePaymentMethods: [AcceptBluePaymentMethod!]!
  }

  enum AcceptBlueFrequencyInput {
    daily
    weekly
    biweekly
    monthly
    bimonthly
    quarterly
    biannually
    annually
  }

  input UpdateAcceptBlueSubscriptionInput {
    id: Int!
    title: String
    frequency: AcceptBlueFrequencyInput
    """
    Amount in cents to bill customer
    """
    amount: Int
    nextRunDate: DateTime
    """
    Number of times the schedule has left to bill. Set to 0 for ongoing
    """
    numLeft: Int
    active: Boolean
    """
    An email address to send a customer receipt to each time the schedule runs
    """
    receiptEmail: String
  }

  enum AcceptBluePaymentMethodType {
    Visa
    MasterCard
    Discover
    Amex
    ECheck
    GooglePay
    ApplePay
  }

  type AcceptBlueSurchargeValue {
    type: String!
    value: Float!
  }

  type AcceptBlueSurcharges {
    check: AcceptBlueSurchargeValue!
    card: AcceptBlueSurchargeValue!
  }

  """
  Used to display eligible payment methods
  """
  type AcceptBluePaymentMethodQuote {
    name: AcceptBluePaymentMethodType!
    tokenizationKey: String
    googlePayMerchantId: String
    googlePayGatewayMerchantId: String
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
    eligibleAcceptBluePaymentMethods: [AcceptBluePaymentMethodQuote!]!
    acceptBlueSurcharges: AcceptBlueSurcharges!
  }

  input UpdateAcceptBlueCardPaymentMethodInput {
    id: Int!
    avs_address: String
    avs_zip: String
    name: String
    expiry_month: Int
    expiry_year: Int
  }

  input UpdateAcceptBlueCheckPaymentMethodInput {
    id: Int!
    name: String
    routing_number: String
    account_type: String
    sec_code: String
  }

  input CreateAcceptBlueCardPaymentMethodInput {
    sourceToken: String!
    expiry_month: Int!
    expiry_year: Int!
    avs_address: String
    avs_zip: String
    name: String
  }

  input CreateAcceptBlueCheckPaymentMethodInput {
    name: String!
    routing_number: String!
    account_number: String!
    account_type: String!
    sec_code: String!
  }

  extend type Mutation {
    updateAcceptBlueCardPaymentMethod(
      input: UpdateAcceptBlueCardPaymentMethodInput!
    ): AcceptBlueCardPaymentMethod!
    updateAcceptBlueCheckPaymentMethod(
      input: UpdateAcceptBlueCheckPaymentMethodInput!
    ): AcceptBlueCheckPaymentMethod!
    deleteAcceptBluePaymentMethod(id: Int!): Boolean!
  }
`;

export const shopApiExtensions = gql`
  ${commonApiExtensions}

  extend type Mutation {
    """
    Creating a card payment method is only allowed with a nonce token.
    See Hosted Tokenization in the Accept Blue docs for more information.
    """
    createAcceptBlueCardPaymentMethod(
      input: CreateAcceptBlueCardPaymentMethodInput!
    ): AcceptBlueCardPaymentMethod!
    createAcceptBlueCheckPaymentMethod(
      input: CreateAcceptBlueCheckPaymentMethodInput!
    ): AcceptBlueCheckPaymentMethod!
  }
`;

export const adminApiExtensions = gql`
  ${commonApiExtensions}

  extend type Mutation {
    """
    Refund a transaction by ID
    """
    refundAcceptBlueTransaction(
      transactionId: Int!
      amount: Int
      cvv2: String
    ): AcceptBlueRefundResult!

    """
    Update the given subscription in Accept Blue
    """
    updateAcceptBlueSubscription(
      input: UpdateAcceptBlueSubscriptionInput!
    ): AcceptBlueSubscription!

    """
    Creating a card payment method is only allowed with a nonce token.
    See Hosted Tokenization in the Accept Blue docs for more information.
    """
    createAcceptBlueCardPaymentMethod(
      input: CreateAcceptBlueCardPaymentMethodInput!
      customerId: Int!
    ): AcceptBlueCardPaymentMethod!
    createAcceptBlueCheckPaymentMethod(
      input: CreateAcceptBlueCheckPaymentMethodInput!
      customerId: Int!
    ): AcceptBlueCheckPaymentMethod!
  }
`;
