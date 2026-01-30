import gql from 'graphql-tag';

export const commonApiExtension = gql`
  type WalletAdjustment {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    amount: Money!
  }

  type Wallet implements Node {
    id: ID!
    name: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    currencyCode: CurrencyCode!
    balance: Money!
    adjustments: [WalletAdjustment!]!
  }

  type WalletList implements PaginatedList {
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

/**
 * These are just to 'fool' the codegen, so that we can statically generate types
 */
export const scalars = gql`
  scalar DateTime
  scalar Money
  scalar CurrencyCode
  scalar JSON
  scalar LogicalOperator
  scalar StringOperators
  scalar LanguageCode
  scalar Node
  scalar PaginatedList
`;
export type PaginatedList = any;
