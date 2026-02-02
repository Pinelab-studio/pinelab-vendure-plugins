import {
  ChannelService,
  DefaultLogger,
  ID,
  LogLevel,
  mergeConfig,
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
import { beforeAll, describe, expect, it } from 'vitest';
import { AddPaymentToOrder } from '../../test/src/generated/shop-graphql';
import { LanguageCode } from '../../test/src/generated/admin-graphql';
import { initialData } from '../../test/src/initial-data';
import {
  addItem,
  createSettledOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  MutationAdjustBalanceForWalletArgs,
  MutationCreateWalletArgs,
  MutationRefundPaymentToStoreCreditArgs,
  Wallet,
} from '../src/api/generated/graphql';
import { storeCreditPaymentHandler } from '../src/config/payment-method-handler';
import { StoreCreditPlugin } from '../src/store-credit.plugin';
import {
  ADJUST_BALANCE_FOR_WALLET,
  buildRandomAmounts,
  CANCEL_ORDER,
  CREATE_CHANNEL,
  CREATE_PAYMENT_METHOD,
  CREATE_WALLET,
  createChannel1Input,
  createChannel2Input,
  GET_CUSTOMER_WITH_WALLETS,
  GET_WALLET_WITH_ADJUSTMENTS,
  MAGIC_NUMBER,
  REFUND_PAYMENT_TO_STORE_CREDIT,
  sum,
  WalletAdjustmentSubscriber,
} from './helpers';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';

describe('Store Credit', function () {
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
          channelId: 1,
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
          description: 'adjusted by superadmin',
        },
      });
      expect(wallet.balance).toBe(100);
      expect(wallet.adjustments.length).toBe(1);
      expect(wallet.adjustments[0].amount).toBe(100);
      expect(wallet.adjustments[0].description).toBe('adjusted by superadmin');
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
          description: 'adjusted by superadmin',
        },
      });
      expect(wallet.balance).toBe(30);
      expect(wallet.adjustments.length).toBe(2);
      expect(wallet.adjustments[0].amount).toBe(100);
      expect(wallet.adjustments[1].amount).toBe(-70);
    });

    it('Should rollback wallet update when adjustment creation fails', async () => {
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
      const { wallet } = await adminClient.query(GET_WALLET_WITH_ADJUSTMENTS, {
        id: 1,
      });
      expect(wallet.balance).toBe(30);
      expect(wallet.adjustments.length).toBe(2);
      expect(wallet.adjustments[0].amount).toBe(100);
      expect(wallet.adjustments[1].amount).toBe(-70);
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

    // TODO: test that failure in adjustment creation also rolls back the balance setting
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
          description: 'adjusted by superadmin',
        },
      });
    });

    it('Should pay for order with store-credit', async () => {
      const { wallet: walletBefore } = await adminClient.query(
        GET_WALLET_WITH_ADJUSTMENTS,
        { id: 1 }
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
          metadata: { walletId: 1 },
        },
      });
      expect((addPaymentToOrder as any)?.errorCode).toBeUndefined();
      const order = addPaymentToOrder;
      expect(order.id).toBeDefined();
      expect(order.state).toBe('PaymentSettled');
      const { wallet: walletAfter } = await adminClient.query(
        GET_WALLET_WITH_ADJUSTMENTS,
        { id: 1 }
      );
      expect(walletAfter.balance).toBeLessThan(walletBefore.balance);
      expect(walletBefore.balance - walletAfter.balance).toBe(
        order.totalWithTax
      );
      expect(
        walletAfter.adjustments[walletAfter.adjustments.length - 1].description
      ).toBe(`paid for order ${order.code}`);
      expect(
        walletAfter.adjustments[walletAfter.adjustments.length - 1].mutatedBy.id
      ).toBe('T_2');
    });

    it('Should fail to pay with insuffcient funds', async () => {
      await adminClient.query<
        { createWallet: Wallet },
        MutationCreateWalletArgs
      >(CREATE_WALLET, {
        input: {
          customerId: 1,
          name: 'My Other Wallet',
          channelId: 1,
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
          metadata: { walletId: 3 },
        },
      });
      expect((addPaymentToOrder as any)?.errorCode).toBe(
        'PAYMENT_DECLINED_ERROR'
      );
      await adminClient.query(CANCEL_ORDER, { id: 2 });
    });

    it('Should reject wallet payment from mismatched channel', async () => {
      //create channels
      await adminClient.query(CREATE_CHANNEL, {
        input: {
          ...createChannel1Input,
          sellerId: 'T_1',
        },
      });

      await adminClient.query(CREATE_CHANNEL, {
        input: {
          ...createChannel2Input,
          sellerId: 'T_1',
        },
      });
      await assignEntititesToChannels();

      // create wallets in channels and adjust balances

      await createWalletAndAdjustBalance(2);
      await createWalletAndAdjustBalance(3);

      // create an active Order in channel 1
      await createActiveOrderForChannel('test-1-token');

      // create an active Order in channel 2
      await createActiveOrderForChannel('test-2-token');

      // checkout happening on channel 1

      shopClient.setChannelToken('test-1-token');

      // try to pay with wallet from another channel and fail

      const { addPaymentToOrder: err } = await shopClient.query(
        AddPaymentToOrder,
        {
          input: {
            method: 'store-credit',
            metadata: { walletId: 4 },
          },
        }
      );

      expect((err as any)?.errorCode).toBe('PAYMENT_DECLINED_ERROR');

      // try to pay with wallet from another channel and succeed

      const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
        input: {
          method: 'store-credit',
          metadata: { walletId: 3 },
        },
      });

      expect((addPaymentToOrder as any)?.errorCode).toBeUndefined();
      await adminClient.query(CANCEL_ORDER, { id: 3 });
      await adminClient.query(CANCEL_ORDER, { id: 4 });
    });
  });

  describe('Refunding Order', () => {
    beforeAll(async () => {
      shopClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
      await adminClient.query<
        { createWallet: Wallet },
        MutationCreateWalletArgs
      >(CREATE_WALLET, {
        input: {
          customerId: 1,
          name: 'My Other Wallet',
          channelId: 1,
        },
      });
      await adminClient.query<
        { adjustBalanceForWallet: Wallet },
        MutationAdjustBalanceForWalletArgs
      >(ADJUST_BALANCE_FOR_WALLET, {
        input: {
          walletId: 5,
          amount: 500000,
          description: 'adjusted by superadmin',
        },
      });
      await createSettledOrder(shopClient, 1, true);
    });

    it('Should refund payment to store credit', async () => {
      const { refundPaymentToStoreCredit: wallet } = await adminClient.query<
        { refundPaymentToStoreCredit: Wallet },
        MutationRefundPaymentToStoreCreditArgs
      >(REFUND_PAYMENT_TO_STORE_CREDIT, {
        paymentId: 5,
        walletId: 5,
      });
      expect(wallet.balance).toBe(7860);
      expect(wallet.adjustments.length).toBe(2);
      expect(wallet.adjustments[0].amount).toBe(500000);
      expect(wallet.adjustments[1].amount).toBe(-492140);
    });
  });

  async function createWalletAndAdjustBalance(channelId: ID) {
    const { createWallet: wallet } = await adminClient.query<
      { createWallet: Wallet },
      MutationCreateWalletArgs
    >(CREATE_WALLET, {
      input: {
        customerId: 1,
        name: 'Wallets',
        channelId,
      },
    });

    await adminClient.query<
      { adjustBalanceForWallet: Wallet },
      MutationAdjustBalanceForWalletArgs
    >(ADJUST_BALANCE_FOR_WALLET, {
      input: {
        walletId: wallet.id,
        amount: 1000000,
        description: 'adjusted by superadmin',
      },
    });
  }

  async function assignEntititesToChannels() {
    const channelService = server.app.get(ChannelService);
    await channelService.assignToChannels(ctx, Product, 1, [2, 3]);
    await channelService.assignToChannels(ctx, ProductVariant, 1, [2, 3]);
    await channelService.assignToChannels(ctx, PaymentMethod, 2, [2, 3]);
    await channelService.assignToChannels(ctx, ShippingMethod, 1, [2, 3]);
  }

  async function createActiveOrderForChannel(token: string) {
    shopClient.setChannelToken(token);

    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );

    const t = await addItem(shopClient, 'T_1', 1);

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
}, 30_000);
