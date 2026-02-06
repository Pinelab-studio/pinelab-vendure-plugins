import {
  ChannelService,
  DefaultLogger,
  ID,
  LogLevel,
  mergeConfig,
  Payment,
  PaymentMethod,
  Product,
  ProductVariant,
  RequestContext,
  ShippingMethod,
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
import { beforeAll, describe, expect, it } from 'vitest';
import { LanguageCode, Refund } from '../../test/src/generated/admin-graphql';
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
  CREATE_WALLET,
  GET_CUSTOMER_WITH_WALLETS,
  GET_WALLET_WITH_ADJUSTMENTS,
  MAGIC_NUMBER,
  REFUND_PAYMENT_TO_STORE_CREDIT,
  sum,
  WalletAdjustmentSubscriber,
} from './helpers';
import gql from 'graphql-tag';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;
let ctx: RequestContext;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [StoreCreditPlugin],
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
      },
    });
    expect(wallet.id).toBeDefined();
    expect(wallet.name).toBe('My Wallet');
    expect(wallet.currencyCode).toBe('USD');
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
    expect(wallet.adjustments.length).toBe(1);
    expect(wallet.adjustments[0].amount).toBe(100);
    expect(wallet.adjustments[0].description).toBe('Adjusted by superadmin');
    expect(wallet.adjustments[0].mutatedBy.id).toBe('T_1');
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
    expect(wallet.adjustments.length).toBe(2);
    expect(wallet.adjustments[0].amount).toBe(100);
    expect(wallet.adjustments[1].amount).toBe(-70);
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
    expect(walletBefore.adjustments.length).toBe(2);
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
    expect(walletAfter.adjustments.length).toBe(2);
    expect(walletAfter.adjustments[0].amount).toBe(100);
    expect(walletAfter.adjustments[1].amount).toBe(-70);
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

    const adjustments = [...wallet.adjustments].sort(
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

  it('Perpares an order for payment', async () => {
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
      walletAfter.adjustments[walletAfter.adjustments.length - 1];
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
      walletAfter.adjustments[walletAfter.adjustments.length - 1];
    expect(lastAdjustment.description).toBe(`Paid for order ${order.code}`);
    expect(lastAdjustment.amount).toBe(-leftToPay);
    expect(lastAdjustment.mutatedBy.id).toBe('T_2');
  });

  it('Should fail to pay with insuffcient funds', async () => {
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
    const promise = adminClient.query<
      { refundPaymentToStoreCredit: WalletAdjustment },
      MutationRefundPaymentToStoreCreditArgs
    >(REFUND_PAYMENT_TO_STORE_CREDIT, {
      input: {
        paymentId: 6,
        amount: 1234,
        reason: 'Product Damaged',
        walletId: walletWithEuroCurrency.id,
      },
    });
    expect(promise).rejects.toThrow(
      "Wallet currency 'EUR' does not match order currency 'USD'. Can not refund payment to this wallet."
    );
  });

  it('Fails to refund when refunding more than the payment amount', async () => {
    const promise = adminClient.query<
      { refundPaymentToStoreCredit: WalletAdjustment },
      MutationRefundPaymentToStoreCreditArgs
    >(REFUND_PAYMENT_TO_STORE_CREDIT, {
      input: {
        paymentId: paymentToRefund.id,
        amount: paymentToRefund.amount + 99, // More than the payment, should fail
        reason: 'Product Damaged',
        walletId: refundWallet.id,
      },
    });
    expect(promise).rejects.toThrow(
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
    expect(walletAfter.adjustments.length).toBe(1);
    expect(walletAfter.adjustments[0].amount).toBe(492140);
    expect(walletAfter.adjustments[0].description).toContain(
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
    const refund = order.payments[0].refunds[0];
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
      name: 'Wallets',
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

async function createActiveOrderForChannel(token: string) {
  shopClient.setChannelToken(token);

  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

  const order = await addItem(shopClient, 'T_1', 1);

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
