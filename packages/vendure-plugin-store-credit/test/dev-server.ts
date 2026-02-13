import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import dotenv from 'dotenv';
import {
  createWalletsForCustomers,
  storeCreditPaymentHandler,
  StoreCreditPlugin,
} from '../src';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  addItem,
  createSettledOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { config } from './vendure-config';
import { VendureConfig } from '@vendure/core';
import { AddPaymentToOrder } from '../../test/src/generated/shop-graphql';
import {
  ADJUST_BALANCE_FOR_WALLET,
  CREATE_PAYMENT_METHOD,
  GET_CUSTOMER_WITH_WALLETS,
} from './helpers';
import { LanguageCode } from '@vendure/core';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  dotenv.config();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };
  const { server, shopClient, adminClient } = createTestEnvironment(
    config as Required<VendureConfig>
  );
  await server.init({
    initialData: {
      ...initialData,
      paymentMethods: [
        {
          name: testPaymentMethod.code,
          handler: { code: testPaymentMethod.code, arguments: [] },
        },
        {
          name: storeCreditPaymentHandler.code,
          handler: { code: storeCreditPaymentHandler.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
  // Create settled order with test method, to test refunding
  await createSettledOrder(shopClient, 1, true);

  // Create wallets for all customers with a special promotion balance
  const wallets = await createWalletsForCustomers(
    server.app,
    {
      name: 'Special promotion wallet 2',
      balance: 500000,
      balanceDescription: 'Special promotion credits',
    },
    'superadmin',
    undefined,
    2
  );
  console.log(`Created ${wallets.length} wallets`);

  // Create store credit payment method
  await adminClient.asSuperAdmin();
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
          languageCode: LanguageCode.en,
        },
      ],
    },
  });

  // Pay for order with store credit
  const user = await shopClient.asUserWithCredentials(
    'hayden.zieme12@hotmail.com',
    'test'
  );
  const order = await addItem(shopClient, 'T_1', 1);
  await proceedToArrangingPayment(shopClient, 1, {
    input: {
      fullName: 'Martinho Pinelabio',
      streetLine1: 'Verzetsstraat',
      streetLine2: '12a',
      city: 'Liwwa',
      postalCode: '8923CP',
      countryCode: 'NL',
    },
  });
  console.log(`Created order ${order.code} in ArrangingPayment state`);
  const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
    input: {
      method: 'store-credit',
      metadata: { walletId: 1 },
    },
  });
  console.log(
    `Paid for order ${order.code} with store credit: ${addPaymentToOrder.state}`
  );

  // Create 12 adjustments for customer 1 / wallet 1
  const options = { options: { take: 50 } };
  for (let i = 1; i <= 12; i++) {
    await adminClient.query(ADJUST_BALANCE_FOR_WALLET, {
      input: {
        walletId: 1,
        amount: i * 100,
        description: `Adjustment ${i} for wallet 1`,
      },
      ...options,
    });
  }
  const { customer } = await adminClient.query(GET_CUSTOMER_WITH_WALLETS, {
    id: '1',
    ...options,
  });
  const wallet1 = customer?.wallets?.items?.[0];
  console.log(
    `Created 12 adjustments for wallet 1. Total items: ${
      wallet1?.adjustments?.totalItems ?? 'n/a'
    }`
  );
})();
