import {
  ChannelService,
  DefaultLogger,
  DefaultStockLocationStrategy,
  EntityHydrator,
  EventBus,
  HistoryService,
  ID,
  idsAreEqual,
  LogLevel,
  mergeConfig,
  PaymentMethod,
  Product,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  ShippingMethod,
  StockLocation,
} from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import { beforeAll, describe, expect, it, vi, beforeEach } from 'vitest';
import { LanguageCode } from '../../test/src/generated/admin-graphql';
import { AddPaymentToOrder } from '../../test/src/generated/shop-graphql';
import { initialData } from '../../test/src/initial-data';
import {
  addItem,
  createSettledOrder,
  getActiveOrder,
  proceedToArrangingPayment,
  SettledOrder,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  MutationAdjustBalanceForWalletArgs,
  MutationCreateWalletArgs,
  MutationRefundPaymentToStoreCreditArgs,
  QueryWalletByCodeArgs,
  Wallet,
  WalletAdjustment,
} from '../src/api/generated/graphql';
import { storeCreditPaymentHandler } from '../src/config/payment-method-handler';
import { StoreCreditPlugin } from '../src/store-credit.plugin';
import {
  ADJUST_BALANCE_FOR_WALLET,
  buildRandomAmounts,
  CANCEL_ORDER,
  channel2Input,
  channel3Input,
  channel4Input,
  CREATE_CHANNEL,
  CREATE_PAYMENT_METHOD,
  CREATE_PRODUCT,
  CREATE_PRODUCT_VARIANTS,
  CREATE_WALLET,
  GET_CUSTOMER_WITH_WALLETS,
  GET_WALLET_BY_CODE,
  GET_WALLET_WITH_ADJUSTMENTS,
  MAGIC_NUMBER,
  REFUND_PAYMENT_TO_STORE_CREDIT,
  sum,
  WalletAdjustmentSubscriber,
} from './helpers';
import gql from 'graphql-tag';
import { createWalletsForCustomers } from '../src/services/exported-helpers';
import { GiftCardWalletCreatedEvent } from '../src/events/gift-card-wallet-created.event';
import { firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;
let ctx: RequestContext;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    catalogOptions: {
      stockLocationStrategy: new DefaultStockLocationStrategy(),
    },
    plugins: [
      StoreCreditPlugin.init({
        createGiftCardWallet: async (ctx, injector, order, orderLine) => {
          const entityHydrator = injector.get(EntityHydrator);
          await entityHydrator.hydrate(ctx, orderLine, {
            relations: ['productVariant'],
          });
          if (idsAreEqual(orderLine.productVariant.productId, 2)) {
            return { price: 100, cardCode: '8pZ2nL9qX5mB' };
          }
          if (
            idsAreEqual(orderLine.productVariant.productId, 3) &&
            idsAreEqual(ctx.channelId, 5)
          ) {
            return { price: 1000000, cardCode: 'K7nR4vT9yLp2' };
          }
          if (
            idsAreEqual(orderLine.productVariant.productId, 3) &&
            idsAreEqual(ctx.channelId, 6)
          ) {
            return { price: 1000000, cardCode: 'qX5mB8pZ2nL9' };
          }
          if (
            idsAreEqual(orderLine.productVariant.productId, 3) &&
            idsAreEqual(ctx.channelId, 7)
          ) {
            return { price: 1000000, cardCode: 'Wj3hG6sA1kM4' };
          }
          return false;
        },
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    dbConnectionOptions: {
      subscribers: [WalletAdjustmentSubscriber],
    },
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData: {
      ...initialData,
      paymentMethods: [
        {
          name: testPaymentMethod.code,
          handler: { code: testPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
    customerCount: 5,
  });
  serverStarted = true;
  await adminClient.asSuperAdmin();

  //create a new Payment Method
  await adminClient.query(CREATE_PAYMENT_METHOD, {
    input: {
      code: 'store-credit',
      enabled: true,
      handler: {
        code: storeCreditPaymentHandler.code,
        arguments: [],
      },
      translations: [
        {
          name: 'Store Credit',
          languageCode: LanguageCode.EnUs,
        },
      ],
    },
  });
  ctx = await getSuperadminContext(server.app);
}, 60000);

describe('Wallets and Adjustments', () => {
  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  it('Should create a wallet for a customer in a specific channel', async () => {
    const { createWallet: wallet } = await adminClient.query<
      { createWallet: Wallet },
      MutationCreateWalletArgs
    >(CREATE_WALLET, {
      input: {
        customerId: 1,
        name: 'My Wallet',
        metadata: { source: 'test', tags: ['e2e'] },
      },
    });
    expect(wallet.id).toBeDefined();
    expect(wallet.name).toBe('My Wallet');
    expect(wallet.currencyCode).toBe('USD');
    expect(wallet.metadata).toEqual({ source: 'test', tags: ['e2e'] });
  });

  it('Should fetch wallets on a Customer object', async () => {
    const { customer } = await adminClient.query(GET_CUSTOMER_WITH_WALLETS, {
      id: '1',
    });
    expect(customer).toBeDefined();
    expect(customer).not.toBeNull();
    expect(customer!.wallets).toBeDefined();
    expect(customer!.wallets.totalItems).toBeGreaterThanOrEqual(1);
    expect(customer!.wallets.items.length).toBeGreaterThanOrEqual(1);
    const wallet = customer!.wallets.items[0];
    expect(wallet.id).toBeDefined();
    expect(wallet.name).toBe('My Wallet');
  });

  it("Should credit a wallet's balance", async () => {
    const { adjustBalanceForWallet: wallet } = await adminClient.query<
      { adjustBalanceForWallet: Wallet },
      MutationAdjustBalanceForWalletArgs
    >(ADJUST_BALANCE_FOR_WALLET, {
      input: {
        walletId: 1,
        amount: 100,
        description: 'Adjusted by superadmin',
      },
    });
    expect(wallet.balance).toBe(100);
    expect(wallet.adjustments.items.length).toBe(1);
    expect(wallet.adjustments.items[0].amount).toBe(100);
    expect(wallet.adjustments.items[0].description).toBe(
      'Adjusted by superadmin'
    );
    expect(wallet.adjustments.items[0].mutatedBy.id).toBe('T_1');
  });

  it("Should debit a wallet's balance", async () => {
    const { adjustBalanceForWallet: wallet } = await adminClient.query<
      { adjustBalanceForWallet: Wallet },
      MutationAdjustBalanceForWalletArgs
    >(ADJUST_BALANCE_FOR_WALLET, {
      input: {
        walletId: 1,
        amount: -70,
        description: 'Adjusted by superadmin',
      },
    });
    expect(wallet.balance).toBe(30);
    expect(wallet.adjustments.items.length).toBe(2);
    expect(wallet.adjustments.items[0].amount).toBe(100);
    expect(wallet.adjustments.items[1].amount).toBe(-70);
  });

  it('Should rollback wallet update when adjustment creation fails', async () => {
    // Check state before failed adjustment
    const { wallet: walletBefore } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      {
        id: 1,
      }
    );
    expect(walletBefore.balance).toBe(30);
    expect(walletBefore.adjustments.items.length).toBe(2);
    await expect(
      adminClient.query<
        { adjustBalanceForWallet: Wallet },
        MutationAdjustBalanceForWalletArgs
      >(ADJUST_BALANCE_FOR_WALLET, {
        input: {
          walletId: 1,
          amount: MAGIC_NUMBER,
          description: 'This should fail',
        },
      })
    ).rejects.toThrow(
      'Update Failed: You passed the forbidden Magic Number 3131746989'
    );
    const { wallet: walletAfter } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      {
        id: 1,
      }
    );
    expect(walletAfter.balance).toBe(30);
    expect(walletAfter.adjustments.items.length).toBe(2);
    expect(walletAfter.adjustments.items[0].amount).toBe(100);
    expect(walletAfter.adjustments.items[1].amount).toBe(-70);
  });

  it('Should apply 200+ sequential credits/debits and keep adjustments consistent', async () => {
    const walletId = 1;

    const N = 200;
    const amounts = buildRandomAmounts(N, { maxAbs: 50, seed: 42 });
    const expectedDelta = sum(amounts);

    for (const amount of amounts) {
      await adminClient.query(ADJUST_BALANCE_FOR_WALLET, {
        input: { walletId, amount, description: 'adjusted by superadmin' },
      });
    }

    const { wallet } = await adminClient.query(GET_WALLET_WITH_ADJUSTMENTS, {
      id: walletId,
    });

    const adjustments = [...wallet.adjustments.items].sort(
      (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
    );

    expect(adjustments.length).toBeGreaterThanOrEqual(N);

    const lastN = adjustments.slice(-N);
    for (let i = 0; i < N; i++) {
      expect(lastN[i].amount).toBe(amounts[i]);
    }

    const deltaFromAdjustments = sum(lastN.map((a) => a.amount));
    expect(deltaFromAdjustments).toBe(expectedDelta);

    const previousBalance = wallet.balance - deltaFromAdjustments;
    expect(wallet.balance).toBe(previousBalance + expectedDelta);
  }, 30_000);

  it('Should return a paginated list of wallet adjustments when valid limit and offset parameters are provided', async () => {
    const walletId = 1;

    const N = 200;
    const take = 13;
    const skip = 14;

    const { wallet } = await adminClient.query(GET_WALLET_WITH_ADJUSTMENTS, {
      id: walletId,
      options: {
        take,
        skip,
      },
    });
    expect(wallet.adjustments.totalItems).toBeGreaterThanOrEqual(N);
    expect(wallet.adjustments.items.length).toBe(take);
    // First item in this page is the (skip+1)th adjustment overall
    expect(wallet.adjustments.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Order with store credit payment', () => {
  beforeAll(async () => {
    await adminClient.query<
      { adjustBalanceForWallet: Wallet },
      MutationAdjustBalanceForWalletArgs
    >(ADJUST_BALANCE_FOR_WALLET, {
      input: {
        walletId: 1,
        amount: 1000000,
        description: 'Adjusted by superadmin',
      },
    });
  });

  it('Prepares an order for payment', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const order = await addItem(shopClient, 'T_1', 1);
    const transitionRes = await proceedToArrangingPayment(shopClient, 1, {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: '8923CP',
        countryCode: 'NL',
      },
    });
    expect((transitionRes as any)?.errorCode).toBeUndefined();
    expect(order.totalWithTax).toBe(155880);
  });

  it('Should partially pay for order with store-credit using amount input', async () => {
    const { wallet: walletBefore } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: 1 }
    );
    const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
      input: {
        method: 'store-credit',
        metadata: { walletId: 1, amount: 100_000 },
      },
    });
    expect((addPaymentToOrder as any)?.errorCode).toBeUndefined();
    const order = addPaymentToOrder;
    expect(order.id).toBeDefined();
    expect(order.state).toBe('ArrangingPayment');
    const { wallet: walletAfter } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: 1 }
    );
    expect(walletAfter.balance).toBe(walletBefore.balance - 100_000);
    const lastAdjustment =
      walletAfter.adjustments.items[walletAfter.adjustments.items.length - 1];
    expect(lastAdjustment.description).toBe(`Paid for order ${order.code}`);
    expect(lastAdjustment.amount).toBe(-100_000);
  });

  it('Should pay outstanding amount for order without specifying amount', async () => {
    const { wallet: walletBefore } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: 1 }
    );
    const { addPaymentToOrder: order } = await shopClient.query(
      AddPaymentToOrder,
      {
        input: {
          method: 'store-credit',
          metadata: { walletId: 1 },
        },
      }
    );
    expect((order as any)?.errorCode).toBeUndefined();
    expect(order.id).toBeDefined();
    expect(order.state).toBe('PaymentSettled');
    const { wallet: walletAfter } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: 1 }
    );
    const leftToPay = order.totalWithTax - 100_000; // already paid in previous test
    expect(walletAfter.balance).toBeLessThan(walletBefore.balance);
    // Expect the new balance to be the old balance minus the amount paid
    expect(walletAfter.balance).toBe(walletBefore.balance - leftToPay);
    const lastAdjustment =
      walletAfter.adjustments.items[walletAfter.adjustments.items.length - 1];
    expect(lastAdjustment.description).toBe(`Paid for order ${order.code}`);
    expect(lastAdjustment.amount).toBe(-leftToPay);
    expect(lastAdjustment.mutatedBy.id).toBe('T_2');
  });

  it('Should fail to pay with insufficient funds', async () => {
    await adminClient.query<{ createWallet: Wallet }, MutationCreateWalletArgs>(
      CREATE_WALLET,
      {
        input: {
          customerId: 1,
          name: 'My Other Wallet',
        },
      }
    );

    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );

    await addItem(shopClient, 'T_1', 1);

    const transitionRes = await proceedToArrangingPayment(shopClient, 1, {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: '8923CP',
        countryCode: 'NL',
      },
    });
    expect((transitionRes as any)?.errorCode).toBeUndefined();
    const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
      input: {
        method: 'store-credit',
        metadata: { walletId: 3 },
      },
    });
    expect((addPaymentToOrder as any)?.errorCode).toBe(
      'PAYMENT_DECLINED_ERROR'
    );
    await adminClient.query(CANCEL_ORDER, { id: 2 });
  });
});

let walletWithEuroCurrency: Wallet;

describe('Channel awareness', () => {
  let walletForChannel2: Wallet;
  let walletForChannel3: Wallet;
  let walletForChannel4: Wallet;

  it('Prepares channels and wallets in channels', async () => {
    // Create channels and assign products etc to them
    await adminClient.query(CREATE_CHANNEL, {
      input: {
        ...channel2Input,
        sellerId: 'T_1',
      },
    });
    await adminClient.query(CREATE_CHANNEL, {
      input: {
        ...channel3Input,
        sellerId: 'T_1',
      },
    });
    await adminClient.query(CREATE_CHANNEL, {
      input: {
        ...channel4Input,
        sellerId: 'T_1',
      },
    });
    await assignEntititesToChannels([2, 3, 4]);

    // create wallets in channels and adjust balance
    walletForChannel2 = await createWalletForChannel(channel2Input.token);
    walletForChannel3 = await createWalletForChannel(channel3Input.token);
    walletForChannel4 = await createWalletForChannel(channel4Input.token);

    // Create active orders for both channels, otherwise an NO_ACTIVE_ORDER_ERROR will be thrown.
    await createActiveOrderForChannel(channel2Input.token);
    await createActiveOrderForChannel(channel3Input.token);
    await createActiveOrderForChannel(channel4Input.token);

    expect(walletForChannel2.balance).toBe(1000000);
    expect(walletForChannel2.currencyCode).toBe('USD');
    expect(walletForChannel3.balance).toBe(1000000);
    expect(walletForChannel3.currencyCode).toBe('USD');
    expect(walletForChannel4.balance).toBe(1000000);
    expect(walletForChannel4.currencyCode).toBe('EUR');
    walletWithEuroCurrency = walletForChannel4;
  });

  it('Fails to pay with wallet from another channel', async () => {
    shopClient.setChannelToken(channel2Input.token);
    const { addPaymentToOrder: err } = await shopClient.query(
      AddPaymentToOrder,
      {
        input: {
          method: 'store-credit',
          metadata: {
            walletId: String(walletForChannel3.id).replace('T_', ''),
          }, // wallet from channel 3, while we are in channel 2
        },
      }
    );
    expect((err as any)?.errorCode).toBe('PAYMENT_DECLINED_ERROR');
    expect((err as any)?.paymentErrorMessage).toBe(
      'Wallet with id 4 is not assigned to the current channel'
    );
  });

  it('Should be allowed to pay with wallet from matching channel', async () => {
    shopClient.setChannelToken(channel2Input.token);
    const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
      input: {
        method: 'store-credit',
        metadata: {
          walletId: String(walletForChannel2.id).replace('T_', ''),
        }, // wallet from channel 2, while we are in channel 2
      },
    });
    expect((addPaymentToOrder as any)?.errorCode).toBeUndefined();
    adminClient.setChannelToken(channel2Input.token);
    const { wallet: walletAfter } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: String(walletForChannel2.id).replace('T_', '') }
    );
    expect(walletAfter.balance).toBeLessThan(1000000);
  });

  it('Fails to pay with a wallet in the correct channel, but in the wrong currency', async () => {
    shopClient.setChannelToken('test-3-token');
    const { addPaymentToOrder: err } = await shopClient.query(
      AddPaymentToOrder,
      {
        input: {
          method: 'store-credit',
          metadata: { walletId: walletForChannel3.id }, // wallet from channel 3, while we are in channel 4
        },
      }
    );
    expect((err as any)?.errorCode).toBe('PAYMENT_DECLINED_ERROR');
  });
});

describe('Refunding Order', () => {
  let orderToRefund: SettledOrder;
  let paymentToRefund: NonNullable<SettledOrder['payments']>[number];
  let refundWallet: Wallet;

  it('Creates a new wallet', async () => {
    adminClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
    const { createWallet } = await adminClient.query<
      { createWallet: Wallet },
      MutationCreateWalletArgs
    >(CREATE_WALLET, {
      input: {
        customerId: 1,
        name: 'My new wallet',
      },
    });
    refundWallet = createWallet;
    expect(refundWallet.id).toBeDefined();
    expect(refundWallet.balance).toBe(0);
  });

  it('Places an order with a "real" payment method', async () => {
    shopClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    let activeOrder = await getActiveOrder(shopClient);
    while (activeOrder) {
      await adminClient.query(CANCEL_ORDER, {
        id: activeOrder?.id?.replace('T_', ''),
      });
      activeOrder = await getActiveOrder(shopClient);
    }
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const order = await createSettledOrder(shopClient, 1);
    orderToRefund = order;
    paymentToRefund = order.payments?.[0]!;
    expect(order.id).toBeDefined();
    expect(order.state).toBe('PaymentSettled');
    expect(order.payments?.length).toBe(1);
    expect(order.payments?.[0].method).toBe(testPaymentMethod.code);
    expect(order.payments?.[0].amount).toBe(492140);
    expect(order.totalWithTax).toBe(492140);
  });

  it('Fails to refund when wallet currency does not match order currency', async () => {
    await expect(
      adminClient.query<
        { refundPaymentToStoreCredit: WalletAdjustment },
        MutationRefundPaymentToStoreCreditArgs
      >(REFUND_PAYMENT_TO_STORE_CREDIT, {
        input: {
          paymentId: paymentToRefund.id,
          amount: 1234,
          reason: 'Product Damaged',
          walletId: walletWithEuroCurrency.id,
        },
      })
    ).rejects.toThrow(
      "Wallet currency 'EUR' does not match order currency 'USD'. Can not refund payment to this wallet."
    );
  });

  it('Fails to refund when refunding more than the payment amount', async () => {
    await expect(
      adminClient.query<
        { refundPaymentToStoreCredit: WalletAdjustment },
        MutationRefundPaymentToStoreCreditArgs
      >(REFUND_PAYMENT_TO_STORE_CREDIT, {
        input: {
          paymentId: paymentToRefund.id,
          amount: paymentToRefund.amount + 99, // More than the payment, should fail
          reason: 'Product Damaged',
          walletId: refundWallet.id,
        },
      })
    ).rejects.toThrow(
      'Refund amount 492239 is greater than payment amount 492140'
    );
  });

  it('Should refund payment to store credit', async () => {
    const { wallet: walletBefore } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: refundWallet.id }
    );
    expect(walletBefore.balance).toBe(0);
    const { refundPaymentToStoreCredit: adjustment } = await adminClient.query<
      { refundPaymentToStoreCredit: WalletAdjustment },
      MutationRefundPaymentToStoreCreditArgs
    >(REFUND_PAYMENT_TO_STORE_CREDIT, {
      input: {
        paymentId: paymentToRefund.id,
        amount: 492140,
        reason: 'Product Damaged',
        walletId: refundWallet.id,
      },
    });
    expect(adjustment.id).toBeDefined();
    expect(adjustment.amount).toBe(492140);
    expect(adjustment.description).toBe(
      `Refund for order ${orderToRefund.code}: Product Damaged`
    );
    const { wallet: walletAfter } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: refundWallet.id }
    );
    expect(walletAfter.balance).toBe(492140);
    expect(walletAfter.adjustments.items.length).toBe(1);
    expect(walletAfter.adjustments.items[0].amount).toBe(492140);
    expect(walletAfter.adjustments.items[0].description).toContain(
      `Refund for order ${orderToRefund.code}: Product Damaged`
    );
  });

  it('Created a refund and history entry on the order', async () => {
    const { order } = await adminClient.query(
      gql`
        query GetOrderDetail($id: ID!) {
          order(id: $id) {
            id
            payments {
              id
              refunds {
                id
                total
                reason
                method
                state
                metadata
                adjustment
                shipping
                items
                transactionId
              }
            }
            history {
              items {
                type
                data
              }
            }
          }
        }
      `,
      { id: orderToRefund.id }
    );
    const payment = order.payments.find((p) => p.id === paymentToRefund.id);
    const refund = payment?.refunds?.[0];
    expect(refund).toBeDefined();
    expect(refund).toMatchObject({
      total: 492140,
      reason: 'Product Damaged',
      method: 'test-payment-method',
      state: 'Settled',
      metadata: {
        walletId: expect.any(String),
        walletAdjustmentId: expect.any(String),
      },
      transactionId: "Refunded to wallet 'My new wallet' (6)",
    });
    expect(order.history.items[order.history.items.length - 1].data.note).toBe(
      `Refunded 492140 for order ${orderToRefund.code}: Product Damaged`
    );
  });

  it('Can not refund again via built-in refund mutation', async () => {
    const result = await adminClient.query(
      gql`
        mutation RefundOrder($input: RefundOrderInput!) {
          refundOrder(input: $input) {
            ... on Refund {
              id
              state
              items
              shipping
              adjustment
              transactionId
              paymentId
              __typename
            }
            ... on ErrorResult {
              errorCode
              message
              __typename
            }
            __typename
          }
        }
      `,
      {
        input: {
          reason: 'Test',
          paymentId: paymentToRefund.id,
          amount: 55555,
          shipping: 0,
          adjustment: 0,
        },
      }
    );
    expect(result.refundOrder).toMatchObject({
      errorCode: 'REFUND_AMOUNT_ERROR',
      message:
        'The amount specified exceeds the refundable amount for this payment',
    });
  });
});

describe('Exported helpers', () => {
  it('Should create wallets for customers', async () => {
    const wallets = await createWalletsForCustomers(
      server.app,
      {
        name: 'Special promotion wallet',
        balance: 123456,
        balanceDescription: 'Special promotion credits',
      },
      'superadmin',
      undefined,
      2
    );
    expect(wallets.length).toBe(5);
    wallets.forEach((wallet) => {
      expect(wallet.name).toBe('Special promotion wallet');
      expect(wallet.balance).toBe(123456);
      expect(wallet.currencyCode).toBe('USD');
    });
  });
});

describe('Gift Card Wallet CRUD', () => {
  it('Should create a gift card wallet in a specific channel', async () => {
    const { createWallet: wallet } = await adminClient.query<
      { createWallet: Wallet },
      MutationCreateWalletArgs
    >(CREATE_WALLET, {
      input: {
        name: 'My Gift Card',
        code: '7K9P2W1Z8N',
      },
    });
    expect(wallet.id).toBeDefined();
    expect(wallet.name).toBe('My Gift Card');
    expect(wallet.code).toBe('7K9P2W1Z8N');
    expect(wallet.currencyCode).toBe('USD');
  });

  it('Should find wallet by code', async () => {
    // Use adminClient: walletByCode on the admin API requires UpdateOrder permission,
    // which superadmin has. Using adminClient avoids polluting the shopClient's
    // active order state which is relied on by later test blocks.
    const { walletByCode: wallet } = await adminClient.query<
      { walletByCode: Wallet },
      QueryWalletByCodeArgs
    >(GET_WALLET_BY_CODE, {
      code: '7K9P2W1Z8N',
    });
    expect(wallet.id).toBeDefined();
    expect(wallet.name).toBe('My Gift Card');
    expect(wallet.code).toBe('7K9P2W1Z8N');
    expect(wallet.currencyCode).toBe('USD');
  });

  it('should return null when provided with a non-existent gift card code', async () => {
    const { walletByCode } = await adminClient.query<
      { walletByCode: Wallet | null },
      QueryWalletByCodeArgs
    >(GET_WALLET_BY_CODE, {
      code: 'non-existent-code',
    });
    expect(walletByCode).toBeNull();
  });
});

describe('Gift Card Payment', () => {
  beforeAll(async () => {
    await adminClient.query<
      { adjustBalanceForWallet: Wallet },
      MutationAdjustBalanceForWalletArgs
    >(ADJUST_BALANCE_FOR_WALLET, {
      input: {
        walletId: 12,
        amount: 1_000_000,
        description: 'Adjusted by superadmin',
      },
    });
  });

  it('Prepares an order for payment', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const order = await addItem(shopClient, 'T_1', 1);
    const transitionRes = await proceedToArrangingPayment(shopClient, 1, {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: '8923CP',
        countryCode: 'NL',
      },
    });
    expect((transitionRes as any)?.errorCode).toBeUndefined();
    expect(order.totalWithTax).toBe(155880);
  });

  it('Should partially pay for order with gift card', async () => {
    const { wallet: walletBefore } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: 12 }
    );
    const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
      input: {
        method: 'store-credit',
        metadata: { giftCardCode: '7K9P2W1Z8N', amount: 100_000 },
      },
    });
    expect((addPaymentToOrder as any)?.errorCode).toBeUndefined();
    const order = addPaymentToOrder;
    expect(order.id).toBeDefined();
    expect(order.state).toBe('ArrangingPayment');
    const { wallet: walletAfter } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: 12 }
    );
    expect(walletAfter.balance).toBe(walletBefore.balance - 100_000);
    const lastAdjustment =
      walletAfter.adjustments.items[walletAfter.adjustments.items.length - 1];
    expect(lastAdjustment.description).toBe(`Paid for order ${order.code}`);
    expect(lastAdjustment.amount).toBe(-100_000);
  });

  it('Should pay outstanding amount for order using a gift card wallet without specifying amount', async () => {
    const { wallet: walletBefore } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: 12 }
    );
    const { addPaymentToOrder: order } = await shopClient.query(
      AddPaymentToOrder,
      {
        input: {
          method: 'store-credit',
          metadata: { giftCardCode: '7K9P2W1Z8N' },
        },
      }
    );
    expect((order as any)?.errorCode).toBeUndefined();
    expect(order.id).toBeDefined();
    expect(order.state).toBe('PaymentSettled');
    const { wallet: walletAfter } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: 12 }
    );
    const leftToPay = order.totalWithTax - 100_000; // already paid in previous test
    expect(walletAfter.balance).toBeLessThan(walletBefore.balance);
    // Expect the new balance to be the old balance minus the amount paid
    expect(walletAfter.balance).toBe(walletBefore.balance - leftToPay);
    const lastAdjustment =
      walletAfter.adjustments.items[walletAfter.adjustments.items.length - 1];
    expect(lastAdjustment.description).toBe(`Paid for order ${order.code}`);
    expect(lastAdjustment.amount).toBe(-leftToPay);
    expect(lastAdjustment.mutatedBy.id).toBe('T_2');
  });

  it('Should fail to pay with a gift card with the wrong code', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );

    await addItem(shopClient, 'T_1', 1);

    const transitionRes = await proceedToArrangingPayment(shopClient, 1, {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: '8923CP',
        countryCode: 'NL',
      },
    });
    expect((transitionRes as any)?.errorCode).toBeUndefined();
    const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
      input: {
        method: 'store-credit',
        metadata: { giftCardCode: 'NON_EXISTENT_CODE' },
      },
    });
    expect((addPaymentToOrder as any)?.errorCode).toBe(
      'PAYMENT_DECLINED_ERROR'
    );
    await adminClient.query(CANCEL_ORDER, { id: 8 });
  });

  it('Should fail to pay with a gift card having insufficient funds', async () => {
    const { createWallet: wallet } = await adminClient.query<
      { createWallet: Wallet },
      MutationCreateWalletArgs
    >(CREATE_WALLET, {
      input: {
        name: 'Gift card with no funds',
        code: 'NO_FUNDS_GIFT_CARD',
      },
    });

    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );

    await addItem(shopClient, 'T_1', 1);

    const transitionRes = await proceedToArrangingPayment(shopClient, 1, {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: '8923CP',
        countryCode: 'NL',
      },
    });
    expect((transitionRes as any)?.errorCode).toBeUndefined();
    const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
      input: {
        method: 'store-credit',
        metadata: { giftCardCode: wallet.code },
      },
    });
    expect((addPaymentToOrder as any)?.errorCode).toBe(
      'PAYMENT_DECLINED_ERROR'
    );
    await adminClient.query(CANCEL_ORDER, { id: 9 });
  });
});

describe('Auto-creation on OrderPlacedEvent', () => {
  it('Should create a gift card Product', async () => {
    const { createProduct: product } = await adminClient.query(CREATE_PRODUCT, {
      input: {
        enabled: true,
        translations: [
          {
            languageCode: LanguageCode.En,
            name: 'Gift Code Product',
            slug: 'cyber-kit',
            description: 'Next-gen upgrades.',
          },
        ],
      },
    });

    expect(product.id).toBeDefined();

    const { createProductVariants } = await adminClient.query(
      CREATE_PRODUCT_VARIANTS,
      {
        input: [
          {
            productId: product.id,
            sku: 'CYB-01',
            price: 15000, // $150.00
            translations: [
              { languageCode: LanguageCode.En, name: 'Standard Edition' },
            ],
            stockOnHand: 100,
          },
        ],
      }
    );

    expect(createProductVariants.length).toBe(1);
    expect(createProductVariants[0].id).toBeDefined();
  });

  it('Should create a Wallet and Order History when checking out with gift card Product', async () => {
    const eventBus = server.app.get(EventBus);

    // Set up the listener to capture 3 events and then complete the stream
    const eventsPromise = firstValueFrom(
      eventBus.ofType(GiftCardWalletCreatedEvent).pipe(take(3), toArray())
    );
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );

    await createSettledOrder(shopClient, 1, true, [
      {
        id: 'T_5',
        quantity: 3,
      },
    ]);

    const events = await eventsPromise;

    expect(events).toHaveLength(3);

    expect(events[0].wallet.code).toBe('8pZ2nL9qX5mB');
    expect(events[1].wallet.code).toBe('8pZ2nL9qX5mB-2');
    expect(events[2].wallet.code).toBe('8pZ2nL9qX5mB-3');

    const history = await server.app
      .get(HistoryService)
      .getHistoryForOrder(ctx, 10, false, {});
    expect(history.totalItems).toBeGreaterThanOrEqual(3);

    expect(history.items[history.items.length - 3].data.note).toBe(
      `Gift card wallet ${events[0].wallet.code} created with balance ${
        events[0].wallet.balance / 100
      } for product with id 2`
    );
    expect(history.items[history.items.length - 2].data.note).toBe(
      `Gift card wallet ${events[1].wallet.code} created with balance ${
        events[1].wallet.balance / 100
      } for product with id 2`
    );
    expect(history.items[history.items.length - 1].data.note).toBe(
      `Gift card wallet ${events[2].wallet.code} created with balance ${
        events[2].wallet.balance / 100
      } for product with id 2`
    );
  });

  it('Should not create a Wallet for a non Gift Card Product', async () => {
    const eventBus = server.app.get(EventBus);
    const capturedEvents: GiftCardWalletCreatedEvent[] = [];

    const sub = eventBus
      .ofType(GiftCardWalletCreatedEvent)
      .subscribe((event) => capturedEvents.push(event));

    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );

    await createSettledOrder(shopClient, 1, true, [
      {
        id: 'T_4',
        quantity: 3,
      },
    ]);

    await new Promise((resolve) => setTimeout(resolve, 50));

    sub.unsubscribe();
    expect(capturedEvents.length).toBe(0);
  });

  it("Should fail to pay with another Customer's wallet", async () => {
    const { createWallet: wallet } = await adminClient.query<
      { createWallet: Wallet },
      MutationCreateWalletArgs
    >(CREATE_WALLET, {
      input: {
        customerId: 2,
        name: 'My Wallet',
        metadata: { source: 'test', tags: ['e2e'] },
      },
    });

    await adminClient.query<
      { adjustBalanceForWallet: Wallet },
      MutationAdjustBalanceForWalletArgs
    >(ADJUST_BALANCE_FOR_WALLET, {
      input: {
        walletId: wallet.id,
        amount: 1000000,
        description: 'Adjusted by superadmin',
      },
    });

    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const order = await addItem(shopClient, 'T_1', 1);
    const transitionRes = await proceedToArrangingPayment(shopClient, 1, {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: '8923CP',
        countryCode: 'NL',
      },
    });
    expect((transitionRes as any)?.errorCode).toBeUndefined();
    expect(order.totalWithTax).toBe(155880);

    const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
      input: {
        method: 'store-credit',
        metadata: { walletId: wallet.id, amount: 100_000 },
      },
    });

    expect((addPaymentToOrder as any)?.errorCode).toBe(
      'PAYMENT_DECLINED_ERROR'
    );
    await adminClient.query(CANCEL_ORDER, {
      id: order?.id,
    });
  });
});

describe('Refunding Order using gift card wallet', () => {
  let orderToRefund: SettledOrder;
  let paymentToRefund: NonNullable<SettledOrder['payments']>[number];
  let refundWallet: Wallet;

  it('Creates a new gift card wallet', async () => {
    const eventBus = server.app.get(EventBus);

    // Set up the listener to capture 3 events and then complete the stream
    const eventsPromise = firstValueFrom(
      eventBus.ofType(GiftCardWalletCreatedEvent).pipe(take(1), toArray())
    );
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );

    await createSettledOrder(shopClient, 1, true, [
      {
        id: 'T_5',
        quantity: 1,
      },
    ]);

    const events = await eventsPromise;

    expect(events).toHaveLength(1);

    expect(events[0].wallet.code).toBe('8pZ2nL9qX5mB-4');
    refundWallet = events[0].wallet as any;
  });

  it('Places an order with a "real" payment method', async () => {
    shopClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    let activeOrder = await getActiveOrder(shopClient);
    while (activeOrder) {
      await adminClient.query(CANCEL_ORDER, {
        id: activeOrder?.id?.replace('T_', ''),
      });
      activeOrder = await getActiveOrder(shopClient);
    }
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const order = await createSettledOrder(shopClient, 1);
    orderToRefund = order;
    paymentToRefund = order.payments?.[0]!;
    expect(order.id).toBeDefined();
    expect(order.state).toBe('PaymentSettled');
    expect(order.payments?.length).toBe(1);
    expect(order.payments?.[0].method).toBe(testPaymentMethod.code);
    expect(order.payments?.[0].amount).toBe(492140);
    expect(order.totalWithTax).toBe(492140);
  });

  it('Fails to refund when wallet currency does not match order currency', async () => {
    await expect(
      adminClient.query<
        { refundPaymentToStoreCredit: WalletAdjustment },
        MutationRefundPaymentToStoreCreditArgs
      >(REFUND_PAYMENT_TO_STORE_CREDIT, {
        input: {
          paymentId: paymentToRefund.id,
          amount: 1234,
          reason: 'Product Damaged',
          walletId: walletWithEuroCurrency.id,
        },
      })
    ).rejects.toThrow(
      "Wallet currency 'EUR' does not match order currency 'USD'. Can not refund payment to this wallet."
    );
  });

  it('Fails to refund when refunding more than the payment amount', async () => {
    await expect(
      adminClient.query<
        { refundPaymentToStoreCredit: WalletAdjustment },
        MutationRefundPaymentToStoreCreditArgs
      >(REFUND_PAYMENT_TO_STORE_CREDIT, {
        input: {
          paymentId: paymentToRefund.id,
          amount: paymentToRefund.amount + 99, // More than the payment, should fail
          reason: 'Product Damaged',
          walletId: refundWallet.id,
        },
      })
    ).rejects.toThrow(
      'Refund amount 492239 is greater than payment amount 492140'
    );
  });

  it('Should refund payment to gift card wallet', async () => {
    const { wallet: walletBefore } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: refundWallet.id }
    );
    expect(walletBefore.balance).toBe(100);
    const { refundPaymentToStoreCredit: adjustment } = await adminClient.query<
      { refundPaymentToStoreCredit: WalletAdjustment },
      MutationRefundPaymentToStoreCreditArgs
    >(REFUND_PAYMENT_TO_STORE_CREDIT, {
      input: {
        paymentId: paymentToRefund.id,
        amount: 492140,
        reason: 'Product Damaged',
        walletId: refundWallet.id,
      },
    });
    expect(adjustment.id).toBeDefined();
    expect(adjustment.amount).toBe(492140);
    expect(adjustment.description).toBe(
      `Refund for order ${orderToRefund.code}: Product Damaged`
    );
    const { wallet: walletAfter } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: refundWallet.id }
    );
    expect(walletAfter.balance).toBe(492140 + walletBefore.balance);
    expect(walletAfter.adjustments.items.length).toBe(1);
    expect(walletAfter.adjustments.items[0].amount).toBe(492140);
    expect(walletAfter.adjustments.items[0].description).toContain(
      `Refund for order ${orderToRefund.code}: Product Damaged`
    );
  });

  it('Created a refund and history entry on the order', async () => {
    const { order } = await adminClient.query(
      gql`
        query GetOrderDetail($id: ID!) {
          order(id: $id) {
            id
            payments {
              id
              refunds {
                total
                reason
                method
                state
                metadata
                shipping
                transactionId
              }
            }
            history {
              items {
                type
                data
              }
            }
          }
        }
      `,
      { id: orderToRefund.id }
    );
    const payment = order.payments.find((p) => p.id === paymentToRefund.id);
    const refund = payment?.refunds?.[0];
    expect(refund).toBeDefined();
    expect(refund).toMatchObject({
      total: 492140,
      reason: 'Product Damaged',
      method: 'test-payment-method',
      state: 'Settled',
      metadata: {
        walletId: expect.any(String),
        walletAdjustmentId: expect.any(String),
      },
      transactionId: "Refunded to wallet '8pZ2nL9qX5mB-4' (18)",
    });
    expect(order.history.items[order.history.items.length - 1].data.note).toBe(
      `Refunded 492140 for order ${orderToRefund.code}: Product Damaged`
    );
  });

  it('Can not refund again via built-in refund mutation', async () => {
    const result = await adminClient.query(
      gql`
        mutation RefundOrder($input: RefundOrderInput!) {
          refundOrder(input: $input) {
            ... on Refund {
              id
              state
              items
              shipping
              adjustment
              transactionId
              paymentId
              __typename
            }
            ... on ErrorResult {
              errorCode
              message
              __typename
            }
            __typename
          }
        }
      `,
      {
        input: {
          reason: 'Test',
          paymentId: paymentToRefund.id,
          amount: 55555,
          shipping: 0,
          adjustment: 0,
        },
      }
    );
    expect(result.refundOrder).toMatchObject({
      errorCode: 'REFUND_AMOUNT_ERROR',
      message:
        'The amount specified exceeds the refundable amount for this payment',
    });
  });
});

describe('Gift Card Wallet Channel awareness', () => {
  let walletForChannel5: Wallet;
  let walletForChannel6: Wallet;
  let walletForChannel7: Wallet;

  it('Should create a digital Gift Card Product', async () => {
    const { createProduct: product } = await adminClient.query(CREATE_PRODUCT, {
      input: {
        enabled: true,
        translations: [
          {
            languageCode: LanguageCode.En,
            name: 'Digital Anniversary Gift Card',
            slug: 'anniversary-gift-card',
            description: 'A digital-only credit for the store.',
          },
        ],
      },
    });

    expect(product.id).toBeDefined();

    const { createProductVariants } = await adminClient.query(
      CREATE_PRODUCT_VARIANTS,
      {
        input: [
          {
            productId: product.id,
            sku: 'GIFT-CARD-100',
            price: 10000,
            translations: [
              { languageCode: LanguageCode.En, name: 'Digital Delivery' },
            ],
            // In a real Vendure setup, you might link an Asset (image) here
            assetIds: [],
            stockOnHand: 100,
          },
        ],
      }
    );

    expect(createProductVariants.length).toBe(1);
    const variant = createProductVariants[0];

    expect(variant.id).toBeDefined();
  });

  it('Prepares channels and wallets', async () => {
    // Create channels and assign products etc to them
    await adminClient.query(CREATE_CHANNEL, {
      input: {
        ...channel2Input,
        token: 'channel-5-for-gift-code',
        code: 'channel-5-for-gift-code',
        sellerId: 'T_1',
      },
    });
    await adminClient.query(CREATE_CHANNEL, {
      input: {
        ...channel3Input,
        token: 'channel-6-for-gift-code',
        code: 'channel-6-for-gift-code',
        sellerId: 'T_1',
      },
    });
    await adminClient.query(CREATE_CHANNEL, {
      input: {
        ...channel4Input,
        token: 'channel-7-for-gift-code',
        code: 'channel-7-for-gift-code',
        sellerId: 'T_1',
      },
    });
    await assignNewEntititesToChannels([5, 6, 7]);

    // create wallets in channels and adjust balance
    walletForChannel5 = await createGiftCardWalletForChannel(
      'channel-5-for-gift-code'
    );
    walletForChannel6 = await createGiftCardWalletForChannel(
      'channel-6-for-gift-code'
    );
    walletForChannel7 = await createGiftCardWalletForChannel(
      'channel-7-for-gift-code'
    );

    // Create active orders for both channels, otherwise an NO_ACTIVE_ORDER_ERROR will be thrown.
    await createActiveOrderForChannel('channel-5-for-gift-code', 'T_6');
    await createActiveOrderForChannel('channel-6-for-gift-code', 'T_6');
    await createActiveOrderForChannel('channel-7-for-gift-code', 'T_6');

    expect(walletForChannel5.balance).toBe(1000000);
    expect(walletForChannel5.currencyCode).toBe('USD');
    expect(walletForChannel6.balance).toBe(1000000);
    expect(walletForChannel6.currencyCode).toBe('USD');
    expect(walletForChannel7.balance).toBe(1000000);
    expect(walletForChannel7.currencyCode).toBe('EUR');
    walletWithEuroCurrency = walletForChannel7;
  });

  it('Fails to pay with wallet from another channel', async () => {
    shopClient.setChannelToken('channel-5-for-gift-code');
    const { addPaymentToOrder: err } = await shopClient.query(
      AddPaymentToOrder,
      {
        input: {
          method: 'store-credit',
          metadata: {
            walletId: String(walletForChannel6.id).replace('T_', ''),
          }, // wallet from channel 6, while we are in channel 6
        },
      }
    );
    expect((err as any)?.errorCode).toBe('PAYMENT_DECLINED_ERROR');
    expect((err as any)?.paymentErrorMessage).toBe(
      'Wallet with id 20 is not assigned to the current channel'
    );
  });

  it('Should be allowed to pay with wallet from matching channel', async () => {
    shopClient.setChannelToken('channel-5-for-gift-code');
    const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
      input: {
        method: 'store-credit',
        metadata: {
          walletId: String(walletForChannel5.id).replace('T_', ''),
        }, // wallet from channel 5, while we are in channel 5
      },
    });
    expect((addPaymentToOrder as any)?.errorCode).toBeUndefined();
    adminClient.setChannelToken('channel-5-for-gift-code');
    const { wallet: walletAfter } = await adminClient.query(
      GET_WALLET_WITH_ADJUSTMENTS,
      { id: String(walletForChannel5.id).replace('T_', '') }
    );
    expect(walletAfter.balance).toBeLessThan(1000000);
  });

  it('Fails to pay with a wallet in the correct channel, but in the wrong currency', async () => {
    shopClient.setChannelToken('channel-7-for-gift-code');
    const { addPaymentToOrder: err } = await shopClient.query(
      AddPaymentToOrder,
      {
        input: {
          method: 'store-credit',
          metadata: { walletId: walletForChannel6.id }, // wallet from channel 6, while we are in channel 7
        },
      }
    );
    expect((err as any)?.errorCode).toBe('PAYMENT_DECLINED_ERROR');
  });
});

/**
 * Creates a wallet for a given channel and adjusts the balance to 1000000.
 */
async function createWalletForChannel(
  setChannelToken: string
): Promise<Wallet> {
  adminClient.setChannelToken(setChannelToken);
  const { createWallet: wallet } = await adminClient.query<
    { createWallet: Wallet },
    MutationCreateWalletArgs
  >(CREATE_WALLET, {
    input: {
      customerId: 1,
      name: `Wallet for ${setChannelToken}`,
    },
  });
  const { adjustBalanceForWallet: adjustedWallet } = await adminClient.query<
    { adjustBalanceForWallet: Wallet },
    MutationAdjustBalanceForWalletArgs
  >(ADJUST_BALANCE_FOR_WALLET, {
    input: {
      walletId: wallet.id,
      amount: 1000000,
      description: 'Adjusted by superadmin',
    },
  });
  return adjustedWallet;
}

async function createGiftCardWalletForChannel(
  setChannelToken: string
): Promise<Wallet> {
  const eventBus = server.app.get(EventBus);
  const eventsPromise = firstValueFrom(
    eventBus.ofType(GiftCardWalletCreatedEvent).pipe(take(1), toArray())
  );

  shopClient.setChannelToken(setChannelToken);

  await createSettledOrder(shopClient, 1, true, [
    {
      id: 'T_6',
      quantity: 1,
    },
  ]);

  const events = await eventsPromise;

  return events[0].wallet as any;
}

/**
 * Assign all products, product variants, payment methods, and shipping methods to channels 2 and 3,
 * so that they can be used in the tests.
 */
async function assignEntititesToChannels(channelIds: ID[]) {
  const channelService = server.app.get(ChannelService);
  await channelService.assignToChannels(ctx, Product, 1, channelIds);
  await channelService.assignToChannels(ctx, ProductVariant, 1, channelIds);
  await channelService.assignToChannels(ctx, PaymentMethod, 2, channelIds);
  await channelService.assignToChannels(ctx, ShippingMethod, 1, channelIds);
}

async function assignNewEntititesToChannels(channelIds: ID[]) {
  const channelService = server.app.get(ChannelService);
  const productVariantService = server.app.get(ProductVariantService);
  await channelService.assignToChannels(ctx, StockLocation, 1, channelIds);
  for (const channelId of channelIds) {
    await productVariantService.assignProductVariantsToChannel(ctx, {
      channelId,
      productVariantIds: [6],
    });
  }
  await channelService.assignToChannels(ctx, Product, 3, channelIds);
  await channelService.assignToChannels(ctx, PaymentMethod, 2, channelIds);
  await channelService.assignToChannels(ctx, PaymentMethod, 1, channelIds);
  await channelService.assignToChannels(ctx, ShippingMethod, 1, channelIds);
}

async function createActiveOrderForChannel(token: string, id = 'T_1') {
  shopClient.setChannelToken(token);

  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

  await addItem(shopClient, id, 1);

  const transitionRes1 = await proceedToArrangingPayment(shopClient, 1, {
    input: {
      fullName: 'Martinho Pinelabio',
      streetLine1: 'Verzetsstraat',
      streetLine2: '12a',
      city: 'Liwwa',
      postalCode: '8923CP',
      countryCode: 'NL',
    },
  });
  expect((transitionRes1 as any)?.errorCode).toBeUndefined();
}
