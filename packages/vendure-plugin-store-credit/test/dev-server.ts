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
import { config } from './vendure-config';
import { VendureConfig } from '@vendure/core';

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
  const { server, shopClient } = createTestEnvironment(
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
