import { initialData } from '../../test/src/initial-data';
import { MyparcelPlugin } from '../src/myparcel.plugin';
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
  PaymentMethodService,
  RequestContext,
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
import { MyparcelService } from '../src/api/myparcel.service';

require('dotenv').config();

(async () => {
  const tunnel = await localtunnel({ port: 3050 });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: true,
      shopApiPlayground: true,
    },
    plugins: [
      MyparcelPlugin.init({
        vendureHost: tunnel.url,
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
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
    customerCount: 2,
  });
  await server.app
    .get(MyparcelService)
    .upsertConfig({ channelId: '1', apiKey: process.env.MYPARCEL_APIKEY! });
  const channel = await server.app.get(ChannelService).getDefaultChannel();
  const ctx = new RequestContext({
    apiType: 'admin',
    isAuthorized: true,
    authorizedAsOwnerOnly: false,
    channel,
  });
  await server.app.get(PaymentMethodService).create(ctx, {
    code: 'test-payment-method',
    name: 'test',
    description: '',
    enabled: true,
    handler: {
      code: 'test-payment-method',
      arguments: [],
    },
  });
  // Add a test-order at every server start
  await addShippingMethod(adminClient, 'my-parcel');
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await addItem(shopClient, 'T_1', 1);
  await addItem(shopClient, 'T_2', 2);
  await proceedToArrangingPayment(shopClient, 3);
  await addPaymentToOrder(shopClient, testPaymentMethod.code);
  console.log('Created test order');
})();
