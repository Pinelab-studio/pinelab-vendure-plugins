import { initialData } from '../../test/src/initial-data';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  RequestContextService,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { createSettledOrder } from '../../test/src/shop-utils';
import { PicklistPlugin } from '../src/plugin';
import { PicklistService } from '../src/api/picklist.service';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Info }),
    plugins: [
      PicklistPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [PicklistPlugin.ui],
          devMode: true,
        }),
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
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
    customerCount: 2,
  });
  // add default Config
  const ctx = await server.app.get(RequestContextService).create({
    apiType: 'admin',
  });
  await server.app.get(PicklistService).upsertConfig(ctx, { enabled: true });
  // Add a testorders at every server start
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await addShippingMethod(adminClient as any, 'manual-fulfillment');
  const orders = 3;
  for (let i = 1; i <= orders; i++) {
    await createSettledOrder(shopClient as any, 3);
  }
  console.log(`Created ${orders} orders`);
})();
