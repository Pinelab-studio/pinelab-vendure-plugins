import '../src/types';
import { initialData } from '../../test/src/initial-data';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  AutoIncrementIdStrategy,
  ChannelService,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { LimitVariantPerOrderPlugin } from '../src/limit-variant-per-order.plugin';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      LimitVariantPerOrderPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, './__admin-ui'),
          extensions: [LimitVariantPerOrderPlugin.uiExtensions],
          devMode: true,
        }),
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    entityOptions: {
      entityIdStrategy: new AutoIncrementIdStrategy(),
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
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
  const channel = await server.app.get(ChannelService).getDefaultChannel();
})();
