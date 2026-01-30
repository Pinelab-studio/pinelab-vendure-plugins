import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { beforeAll, describe, expect, it } from 'vitest';
import { LanguageCode } from '../../test/src/generated/admin-graphql';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
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
  CREATE_PAYMENT_METHOD,
  CREATE_WALLET,
  GET_WALLET_WITH_ADJUSTMENTS,
  REFUND_PAYMENT_TO_STORE_CREDIT,
  sum,
} from './helpers';

describe('Store Credit', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [StoreCreditPlugin],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
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
      expect((wallet.customer as any).id).toBeDefined();
    });

    it("Should credit a wallet's balance", async () => {
      const { adjustBalanceForWallet: wallet } = await adminClient.query<
        { adjustBalanceForWallet: Wallet },
        MutationAdjustBalanceForWalletArgs
      >(ADJUST_BALANCE_FOR_WALLET, {
        input: {
          walletId: 1,
          amount: 100,
        },
      });
      expect(wallet.balance).toBe(100);
      expect(wallet.adjustments.length).toBe(1);
      expect(wallet.adjustments[0].amount).toBe(100);
    });

    it("Should debit a wallet's balance", async () => {
      const { adjustBalanceForWallet: wallet } = await adminClient.query<
        { adjustBalanceForWallet: Wallet },
        MutationAdjustBalanceForWalletArgs
      >(ADJUST_BALANCE_FOR_WALLET, {
        input: {
          walletId: 1,
          amount: -70,
        },
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
          input: { walletId, amount },
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

  describe('Refunding Order', () => {
    beforeAll(async () => {
      //create a new Payment Method
      await adminClient.query<
        { createWallet: Wallet },
        MutationCreateWalletArgs
      >(CREATE_WALLET, {
        input: {
          customerId: 1,
          name: 'My Other Wallet',
        },
      });
      await adminClient.query<
        { adjustBalanceForWallet: Wallet },
        MutationAdjustBalanceForWalletArgs
      >(ADJUST_BALANCE_FOR_WALLET, {
        input: {
          walletId: 2,
          amount: 500000,
        },
      });
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
      await createSettledOrder(shopClient, 1, true);
    });

    it('Should refund payment to store credit', async () => {
      const { refundPaymentToStoreCredit: wallet } = await adminClient.query<
        { refundPaymentToStoreCredit: Wallet },
        MutationRefundPaymentToStoreCreditArgs
      >(REFUND_PAYMENT_TO_STORE_CREDIT, {
        paymentId: 1,
        walletId: 2,
      });
      expect(wallet.balance).toBe(7860);
      expect(wallet.adjustments.length).toBe(2);
      expect(wallet.adjustments[0].amount).toBe(500000);
      expect(wallet.adjustments[1].amount).toBe(-492140);
    });
  });
}, 30_000);
