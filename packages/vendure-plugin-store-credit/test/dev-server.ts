import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
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
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  dotenv.config();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    authOptions: {
      tokenMethod: ['cookie', 'bearer'],
    },
    dbConnectionOptions: {
      autoSave: true,
    },
    paymentOptions: {
      paymentMethodHandlers: [storeCreditPaymentHandler, testPaymentMethod],
    },
    plugins: [
      StoreCreditPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
  });
  const { server, shopClient } = createTestEnvironment(config);
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
  await createSettledOrder(shopClient, 1, true);

  // Create wallets for all customers with a special promotion balance
  const wallets = await createWalletsForCustomers(
    server.app,
    {
      name: 'Special promotion wallet 2',
      balance: 44444,
      balanceDescription: 'Special promotion credits',
    },
    'superadmin',
    undefined,
    2
  );

  console.log(`Created ${wallets.length} wallets`);
})();
