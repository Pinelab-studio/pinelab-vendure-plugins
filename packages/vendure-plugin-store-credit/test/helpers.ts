import { gql } from 'graphql-tag';

export const WALLET_FIELDS = gql`
  fragment WalletFields on Wallet {
    id
    name
    createdAt
    updatedAt
    currencyCode
    balance
    name
    adjustments {
      amount
    }
  }
`;

export const GET_WALLET_WITH_ADJUSTMENTS = gql`
  query GetWalletById($id: ID!) {
    wallet(id: $id) {
      ...WalletFields
    }
  }
  ${WALLET_FIELDS}
`;

export const CREATE_WALLET = gql`
  mutation CreateWallet($input: CreateWalletInput!) {
    createWallet(input: $input) {
      ...WalletFields
    }
  }
  ${WALLET_FIELDS}
`;

export const ADJUST_BALANCE_FOR_WALLET = gql`
  mutation UpdateWallet($input: AdjustBalanceForWalletInput!) {
    adjustBalanceForWallet(input: $input) {
      ...WalletFields
    }
  }
  ${WALLET_FIELDS}
`;

export const CREATE_PAYMENT_METHOD = gql`
  mutation CreatePaymentMethod($input: CreatePaymentMethodInput!) {
    createPaymentMethod(input: $input) {
      id
    }
  }
`;

export const REFUND_PAYMENT_TO_STORE_CREDIT = gql`
  mutation refundPaymentToStoreCredit($paymentId: ID!, $walletId: ID!) {
    refundPaymentToStoreCredit(paymentId: $paymentId, walletId: $walletId) {
      ...WalletFields
    }
  }
  ${WALLET_FIELDS}
`;

export const GET_CUSTOMER_WITH_WALLETS = gql`
  query GetCustomerWithWallets($id: ID!) {
    customer(id: $id) {
      id
      wallets {
        items {
          ...WalletFields
        }
        totalItems
      }
    }
  }
  ${WALLET_FIELDS}
`;

export const chunk = <T>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const sum = (nums: number[]) => nums.reduce((a, b) => a + b, 0);

export const buildRandomAmounts = (
  count: number,
  opts?: { maxAbs?: number; seed?: number }
) => {
  const maxAbs = opts?.maxAbs ?? 25;
  let s = (opts?.seed ?? 123456789) >>> 0;

  const rand = () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 2 ** 32;
  };

  return Array.from({ length: count }, () => {
    const sign = rand() < 0.5 ? -1 : 1;
    const mag = 1 + Math.floor(rand() * maxAbs);
    return sign * mag;
  });
};
