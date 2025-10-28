// This import is needed to accept custom field types
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { ValidateCartPlugin } from '../src/validate-cart.plugin';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  // eslint-disable-next-line
  require('dotenv').config();

  // eslint-disable-next-line
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config: Required<VendureConfig> = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    dbConnectionOptions: {
      autoSave: true,
    },
    authOptions: {
      tokenMethod: ['cookie', 'bearer'],
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      ValidateCartPlugin.init({}),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
  await server.init({
    initialData: {
      // eslint-disable-next-line
      ...require('../../test/src/initial-data').initialData,
      shippingMethods: [{ name: 'Standard Shipping', price: 0 }],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });

  const port = config.apiOptions?.port ?? '';
  console.log(`Vendure server now running on port ${port}`);
})();
