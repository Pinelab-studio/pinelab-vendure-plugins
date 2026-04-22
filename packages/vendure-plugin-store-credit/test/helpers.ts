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

export const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      id
      name
      slug
      description
      enabled
    }
  }
`;

export const CREATE_PRODUCT_VARIANTS = gql`
  mutation CreateProductVariants($input: [CreateProductVariantInput!]!) {
    createProductVariants(input: $input) {
      id
      name
      sku
      price
      stockOnHand
    }
  }
`;

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

export const WALLET_BASE_FIELDS = gql`
  fragment WalletBaseFields on Wallet {
    id
    code
    name
    createdAt
    updatedAt
    currencyCode
    balance
    metadata
  }
`;

export const ADMIN_WALLET_FIELDS = gql`
  fragment AdminWalletFields on Wallet {
    ...WalletBaseFields
    adjustments(options: $options) {
      items {
        id
        createdAt
        amount
        description
        mutatedBy {
          id
          identifier
        }
      }
      totalItems
    }
  }
  ${WALLET_BASE_FIELDS}
`;

export const SHOP_WALLET_FIELDS = gql`
  fragment ShopWalletFields on Wallet {
    ...WalletBaseFields
    adjustments(options: $options) {
      items {
        id
        createdAt
        amount
        description
      }
      totalItems
    }
  }
  ${WALLET_BASE_FIELDS}
`;

export const GET_WALLET_WITH_ADJUSTMENTS = gql`
  query GetWalletById($id: ID!, $options: WalletAdjustmentListOptions) {
    wallet(id: $id) {
      ...AdminWalletFields
    }
  }
  ${ADMIN_WALLET_FIELDS}
`;

export const CREATE_WALLET = gql`
  mutation CreateWallet(
    $input: CreateWalletInput!
    $options: WalletAdjustmentListOptions
  ) {
    createWallet(input: $input) {
      ...AdminWalletFields
    }
  }
  ${ADMIN_WALLET_FIELDS}
`;

export const GET_WALLET_BY_CODE = gql`
  query GetWalletByCode($code: String!, $options: WalletAdjustmentListOptions) {
    walletByCode(code: $code) {
      ...ShopWalletFields
    }
  }
  ${SHOP_WALLET_FIELDS}
`;

export const ADJUST_BALANCE_FOR_WALLET = gql`
  mutation UpdateWallet(
    $input: AdjustBalanceForWalletInput!
    $options: WalletAdjustmentListOptions
  ) {
    adjustBalanceForWallet(input: $input) {
      ...AdminWalletFields
    }
  }
  ${ADMIN_WALLET_FIELDS}
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
  query GetCustomerWithWallets(
    $id: ID!
    $options: WalletAdjustmentListOptions
  ) {
    customer(id: $id) {
      id
      wallets {
        items {
          ...AdminWalletFields
        }
        totalItems
      }
    }
  }
  ${ADMIN_WALLET_FIELDS}
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
