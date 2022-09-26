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
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  getCouponCodes,
  getNrOfOrders,
  ParcelInputItem,
  SendcloudPlugin,
  sendcloudHandler,
  sendcloudMiddleware,
} from '../src';
import { addShippingMethod } from '../../test/src/admin-utils';
import { createSettledOrder } from '../../test/src/shop-utils';
import { updateSendCloudConfig } from './test.helpers';
require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: true,
      shopApiPlayground: true,
    },
    plugins: [
      SendcloudPlugin.init({
        additionalParcelItemsFn: async (ctx, injector, order) => {
          const additionalInputs: ParcelInputItem[] = [];
          additionalInputs.push(await getNrOfOrders(ctx, injector, order));
          const coupons = getCouponCodes(order);
          if (coupons) {
            additionalInputs.push(coupons);
          }
          return additionalInputs;
        },
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        /*        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [MyparcelPlugin.ui],
          devMode: true,
        }),*/
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
      shippingMethods: [],
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
  server.app.use(sendcloudMiddleware.route, sendcloudMiddleware.handler);
  await addShippingMethod(adminClient, sendcloudHandler.code);
  await adminClient.asSuperAdmin();
  await updateSendCloudConfig(
    adminClient,
    process.env.SECRET!,
    process.env.PUBLIC!
  );
  await createSettledOrder(shopClient, 1);
  console.log('created test order');
})();
