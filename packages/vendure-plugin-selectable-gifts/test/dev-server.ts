import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import path from 'path';
import { initialData } from '../../test/src/initial-data';
import { SelectableGiftsPlugin } from '../src';
import {
  ADD_ITEM_TO_ORDER,
  createPromotion,
  ELIGIBLE_GIFTS,
  getEligibleGifts,
} from './helpers';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),

    plugins: [
      AssetServerPlugin.init({
        assetUploadDir: path.join(__dirname, '__data__/assets'),
        route: 'assets',
      }),
      SelectableGiftsPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  await adminClient.asSuperAdmin();
  await createPromotion(
    adminClient,
    'Gift for orders above $0',
    ['T_1'],
    [
      {
        code: 'minimum_order_amount',
        arguments: [
          {
            name: 'amount',
            value: '0',
          },
          {
            name: 'taxInclusive',
            value: 'false',
          },
        ],
      },
    ]
  );
  // Create an active order
  await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: 'T_1',
    quantity: 1,
  });
  const gifts = await getEligibleGifts(shopClient);
  console.log(gifts);
})();
