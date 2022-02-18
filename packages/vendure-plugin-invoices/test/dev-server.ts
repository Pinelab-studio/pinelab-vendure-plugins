import { initialData } from '../../test/src/initial-data';
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
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import { InvoicePlugin } from '../src';
import { InvoiceService } from '../src/api/invoice.service';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      InvoicePlugin.init({}),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        /*        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [],
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
  const channel = await server.app.get(ChannelService).getDefaultChannel();
  await server.app
    .get(InvoiceService)
    .upsertConfig(channel.id as string, { enabled: true });
  // Add a test-order at every server start
  await addShippingMethod(adminClient, 'manual-fulfillment');
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await addItem(shopClient, 'T_1', 1);
  await addItem(shopClient, 'T_2', 2);
  await proceedToArrangingPayment(shopClient);
  const order = await addPaymentToOrder(shopClient, testPaymentMethod.code);
  console.log(
    `Download invoice via http://localhost:3050/invoices/e2e-default-channel/${
      (order as any).code
    }?email=hayden.zieme12@hotmail.com`
  );
})();
