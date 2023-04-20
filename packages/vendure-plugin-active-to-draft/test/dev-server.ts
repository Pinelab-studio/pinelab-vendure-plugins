/* eslint no-use-before-define: 0 */
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler/';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import path from 'path';
import { convertToDraftButton } from '../src/ui';
import { ActiveToDraftPlugin } from '../src/active-to-draft.plugin';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [
      DefaultSearchPlugin,
      ActiveToDraftPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [convertToDraftButton],
          devMode: true,
        }),
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
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
  await addItem(shopClient, 'T_1', 1);
  await createSettledOrder(shopClient, 1);
})();
