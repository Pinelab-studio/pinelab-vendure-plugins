import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
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
import path from 'path';
import { updateVariants } from '../../test/src/admin-utils';
import { GlobalFlag } from '../../test/src/generated/admin-graphql';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { PicqerPlugin } from '../src';
import { UPSERT_CONFIG } from '../src/ui/queries';

(async () => {
  require('dotenv').config();
  const { testConfig } = require('@vendure/testing');
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
      PicqerPlugin.init({
        enabled: true,
        vendureHost: process.env.HOST!,
        // These are just test values to test the strtegies, they don't mean anything in this context
        pushProductVariantFields: (variant) => ({ barcode: variant.sku }),
        pullPicqerProductFields: (picqerProd) => ({ outOfStockThreshold: 123 }),
        addPicqerOrderNote: (order) => 'test note',
      }),
      AssetServerPlugin.init({
        assetUploadDir: path.join(__dirname, '../__data__/assets'),
        route: 'assets',
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        // app: compileUiExtensions({
        //   outputPath: path.join(__dirname, '__admin-ui'),
        //   extensions: [PicqerPlugin.ui],
        //   devMode: true,
        // }),
      }),
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
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
  await adminClient.asSuperAdmin();
  await adminClient.query(UPSERT_CONFIG, {
    input: {
      enabled: true,
      apiKey: process.env.APIKEY,
      apiEndpoint: process.env.ENDPOINT,
      storefrontUrl: 'mystore.io',
      supportEmail: 'support@mystore.io',
    },
  });
  // await adminClient.query(FULL_SYNC);
  const variants = await updateVariants(adminClient, [
    { id: 'T_1', trackInventory: GlobalFlag.True },
    { id: 'T_2', trackInventory: GlobalFlag.True },
    { id: 'T_3', trackInventory: GlobalFlag.True },
    { id: 'T_4', trackInventory: GlobalFlag.True },
  ]);
  const order = await createSettledOrder(shopClient, 1);
})();
