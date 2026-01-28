import gql from 'graphql-tag';

export const scalars = gql`
  scalar DateTime
  scalar Money
  scalar CurrencyCode
`;

export const commonApiExtension = gql`
  type Wallet {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    customer: Customer!
    currencyCode: CurrencyCode!
    balance: Money!
  }

  extend type Customer {
    wallets: [Wallet!]!
  }
`;

export const adminApiExtensions = gql`
  ${commonApiExtension}

  type WalletAdjustment {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    wallet: Wallet!
    amount: String!
  }

  input CreateWalletInput {
    customerId: ID!
    initialBalance: Money!
  }

  enum WalletAdjustmentType {
    CREDIT
    DEBIT
  }

  input AdjustBalanceForWalletInput {
    amount: Money!
    adjustmentType: WalletAdjustmentType!
    walletId: ID!
  }

  extend type Mutation {
    createWallet(input: CreateWalletInput!): Wallet!
    adjustBalanceForWallet(input: AdjustBalanceForWalletInput!): Wallet!
  }
`;
