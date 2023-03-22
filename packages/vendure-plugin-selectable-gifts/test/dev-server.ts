import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  ChannelService,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  RequestContext,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import path from 'path';
import { initialData } from '../../test/src/initial-data';
import { SelectableGiftsPlugin } from '../src';
import { createPromotion } from './helpers';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { GiftService } from '../src/gift.service';
import { ADD_ITEM_TO_ORDER } from './helpers';

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
  await createPromotion(adminClient).catch((e) => console.error(e));
  // Create an active order
  await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: '1',
    quantity: 2,
    customFields: {
      isSelectedAsGift: true,
    },
  });
  const channel = await server.app.get(ChannelService).getDefaultChannel();
  const ctx = new RequestContext({
    channel,
    authorizedAsOwnerOnly: false,
    apiType: 'admin',
    isAuthorized: true,
  });
  const res = await server.app
    .get(GiftService)
    .getEligibleGiftsForOrder(ctx, '1')
    .catch((e) => console.error(e));
})();
