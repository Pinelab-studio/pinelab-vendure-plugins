import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  configureDefaultOrderProcess,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  OrderProcess,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { addShippingMethod } from '../../test/src/admin-utils';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { CampaignTrackerPlugin } from '../src';

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
      CampaignTrackerPlugin.init({}),
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
