import { initialData } from '../../test/src/initial-data';
import { MyparcelPlugin } from '../src/myparcel.plugin';
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
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import localtunnel from 'localtunnel';

require('dotenv').config();

(async () => {
  const tunnel = await localtunnel({ port: 3050 });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      MyparcelPlugin.init(
        {
          'e2e-default-channel': process.env.MYPARCEL_APIKEY!,
        },
        tunnel.url
      ),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
    customerCount: 2,
  });

  // Add a test-order at every server start
  await addShippingMethod(adminClient, 'my-parcel');
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await addItem(shopClient, 'T_1', 1);
  await addItem(shopClient, 'T_2', 2);
  await proceedToArrangingPayment(shopClient);
  await addPaymentToOrder(shopClient, testPaymentMethod.code);
})();
