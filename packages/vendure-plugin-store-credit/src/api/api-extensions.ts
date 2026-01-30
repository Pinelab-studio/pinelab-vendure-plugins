import gql from 'graphql-tag';

export const scalars = gql`
  scalar DateTime
  scalar Money
  scalar CurrencyCode
  scalar JSON
  scalar LogicalOperator
  scalar StringOperators
  scalar LanguageCode
`;

export const commonApiExtension = gql`
  type WalletAdjustment {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    wallet: Wallet!
    amount: Money!
  }

  type Wallet {
    id: ID!
    name: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    customer: Customer!
    currencyCode: CurrencyCode!
    balance: Money!
    adjustments: [WalletAdjustment!]!
  }

  type WalletList {
    items: [Wallet!]!
    totalItems: Int!
  }

  input WalletListFilter {
    name: StringOperators
  }

  input WalletListOptions {
    skip: Int
    take: Int
    filter: WalletListFilter
    filterOperator: LogicalOperator
    sort: JSON
  }

  extend type Customer {
    wallets(options: WalletListOptions): WalletList!
  }

  extend type Query {
    wallet(id: ID!): Wallet!
  }
`;

export const adminApiExtensions = gql`
  ${commonApiExtension}

  input CreateWalletInput {
    customerId: ID!
    name: String!
  }

  input AdjustBalanceForWalletInput {
    amount: Money!
    walletId: ID!
  }

  extend type Mutation {
    createWallet(input: CreateWalletInput!): Wallet!
    adjustBalanceForWallet(input: AdjustBalanceForWalletInput!): Wallet!
    refundPaymentToStoreCredit(paymentId: ID!, walletId: ID!): Wallet!
  }
`;
