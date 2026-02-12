import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  configureDefaultOrderProcess,
  DefaultLogger,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
  EntityHydrator,
  LogLevel,
  mergeConfig,
  OrderProcess,
  VendureConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { QlsPlugin, qlsSyncAllProductsTask } from '../src';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { createSettledOrder } from '../../test/src/shop-utils';

/**
 * The dev-server is just for development. Feel free to break anything here.
 */
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
      synchronize: true,
      autoSave: true, // Uncomment this line to persist the database between restarts
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
    orderOptions: {
      process: [
        configureDefaultOrderProcess({
          checkFulfillmentStates: false,
        }) as OrderProcess<any>,
      ],
    },
    plugins: [
      QlsPlugin.init({
        getConfig: () => ({
          username: process.env.QLS_USERNAME!,
          password: process.env.QLS_PASSWORD!,
          companyId: process.env.QLS_COMPANY_ID!,
          url: process.env.QLS_URL,
          brandId: process.env.QLS_BRAND_ID!,
        }),
        getAdditionalOrderFields: () => {
          return {
            delivery_options: [{ tag: 'dhl-germany-national' }],
          };
        },
        getAdditionalVariantFields: (ctx, variant) => ({
          ean: variant.sku,
          image_url: `https://pinelab.studio/remote-img/6fa890c7-cd4c-4715-ad73-daa99cd6fe7f_pinelab_e-commerce_hero_image_medium.webp`,
          // Just testing additionalEANs: [Math.floor(Math.random() * 1000).toString()],
          additionalEANs: ['somethingelse'],
        }),
        webhookSecret: '121231',
        excludeVariantFromSync: async (ctx, injector, variant) => {
          await injector.get(EntityHydrator).hydrate(ctx, variant, {
            relations: ['facetValues'],
          });
          return variant.id == 1; // Just as a test
        },
        autoPushOrders: true,
        processOrderFrom: (ctx, order) => {
          return new Date(Date.now() + 1000 * 60 * 60 * 2); // 2 hours from now
        },
        qlsProductIdUiTab: null,
      }),
      DefaultSchedulerPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [QlsPlugin.ui],
          devMode: true,
        }),
      }),
    ],
    schedulerOptions: {
      runTasksInWorkerOnly: false,
      tasks: [qlsSyncAllProductsTask],
    },
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

  await createSettledOrder(
    shopClient,
    1,
    true,
    [
      { id: 'T_1', quantity: 1 },
      { id: 'T_2', quantity: 2 },
    ],
    undefined,
    {
      input: {
        countryCode: 'NL',
        streetLine1: 'Verzetsstraat',
        streetLine2: '48',
        city: 'Liwwa',
        postalCode: '8932 BR',
      },
    }
  );
})();
