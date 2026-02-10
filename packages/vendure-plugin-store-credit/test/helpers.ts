import { gql } from 'graphql-tag';
import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
} from 'typeorm';
import { WalletAdjustment } from '../src/entities/wallet-adjustment.entity';
import {
  CreateChannelInput,
  LanguageCode,
  CurrencyCode,
} from '@vendure/common/lib/generated-types';

export const MAGIC_NUMBER = 0xbaaaaaad;

export const CANCEL_ORDER = gql`
  mutation CancelOrder($id: ID!) {
    cancelOrder(input: { orderId: $id }) {
      ... on Order {
        id
      }
    }
  }
`;

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
      description
      mutatedBy {
        id
      }
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
  mutation refundPaymentToStoreCredit($input: StoreCreditRefundInput!) {
    refundPaymentToStoreCredit(input: $input) {
      id
      amount
      description
      mutatedBy {
        id
      }
    }
  }
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

export const CREATE_CHANNEL = gql`
  mutation CreateChannelQuery($input: CreateChannelInput!) {
    createChannel(input: $input) {
      ... on Channel {
        code
        id
        token
      }
    }
  }
`;

export const ASSIGN_PRODUCTVARIANT_TO_CHANNEL = gql`
  mutation AssignProductVariantsToChannel(
    $input: AssignProductVariantsToChannelInput!
  ) {
    assignProductVariantsToChannel(input: $input) {
      ... on ProductVariant {
        id
      }
    }
  }
`;

export const channel2Input: CreateChannelInput = {
  code: 'test-2',
  defaultLanguageCode: LanguageCode.en,
  defaultShippingZoneId: 1,
  defaultTaxZoneId: 1,
  pricesIncludeTax: true,
  token: 'test-2-token',
  defaultCurrencyCode: CurrencyCode.USD,
};

export const channel3Input: CreateChannelInput = {
  code: 'test-3',
  defaultLanguageCode: LanguageCode.en,
  defaultShippingZoneId: 1,
  defaultTaxZoneId: 1,
  pricesIncludeTax: true,
  token: 'test-3-token',
  defaultCurrencyCode: CurrencyCode.USD,
};

export const channel4Input: CreateChannelInput = {
  code: 'test-4',
  defaultLanguageCode: LanguageCode.en,
  defaultShippingZoneId: 1,
  defaultTaxZoneId: 1,
  pricesIncludeTax: true,
  token: 'test-4-token',
  defaultCurrencyCode: CurrencyCode.EUR,
};

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

/**
 * Make the DB insert fail if MAGIC_NUMBER is passed in as an amount, so that we can test rollback of the transaction.
 */
@EventSubscriber()
export class WalletAdjustmentSubscriber
  implements EntitySubscriberInterface<WalletAdjustment>
{
  listenTo() {
    return WalletAdjustment;
  }

  beforeInsert(event: InsertEvent<WalletAdjustment>) {
    this.validateStatus(event.entity.amount);
  }

  private validateStatus(status: number) {
    if (status === MAGIC_NUMBER) {
      throw new Error(
        `Update Failed: You passed the forbidden Magic Number ${MAGIC_NUMBER}`
      );
    }
  }
}
