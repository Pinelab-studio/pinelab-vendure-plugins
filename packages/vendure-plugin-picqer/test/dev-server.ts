import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import {
  configureDefaultOrderProcess,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  OrderProcess,
} from '@vendure/core';
import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
} from '@vendure/testing';
import path from 'path';
import { updateVariants, addShippingMethod } from '../../test/src/admin-utils';
import { GlobalFlag } from '../../test/src/generated/admin-graphql';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { PicqerPlugin } from '../src';
import { FULL_SYNC, UPSERT_CONFIG } from '../src/ui/queries';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { picqerHandler } from '../dist/vendure-plugin-picqer/src/api/picqer.handler';

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
    orderOptions: {
      process: [
        configureDefaultOrderProcess({
          checkFulfillmentStates: false,
        }) as OrderProcess<any>,
      ],
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    customFields: {
      // Sample custom field to test the custom fields config behavior
      ProductVariant: [
        {
          name: 'noLongerAvailable',
          type: 'string',
        },
      ],
    },
    plugins: [
      PicqerPlugin.init({
        enabled: true,
        vendureHost: process.env.HOST!,
        // These are just test values to test the strtegies, they don't mean anything in this context
        pushProductVariantFields: (variant) => ({ barcode: variant.sku }),
        pullPicqerProductFields: (picqerProd) => ({ outOfStockThreshold: 123 }),
        pushPicqerOrderFields: (order) => ({
          customer_remarks: 'test note',
          pickup_point_data: {
            carrier: 'dhl',
            id: '901892834',
          },
        }),
        shouldSyncOnProductVariantCustomFields: ['noLongerAvailable'],
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
  await addShippingMethod(adminClient, picqerHandler.code);
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
  // const variants = await updateVariants(adminClient, [
  //   { id: 'T_1', trackInventory: GlobalFlag.True },
  //   { id: 'T_2', trackInventory: GlobalFlag.True },
  //   { id: 'T_3', trackInventory: GlobalFlag.True },
  //   { id: 'T_4', trackInventory: GlobalFlag.True },
  // ]);
  const order = await createSettledOrder(shopClient, 3, true, [
    { id: 'T_1', quantity: 3 },
  ]);
})();
