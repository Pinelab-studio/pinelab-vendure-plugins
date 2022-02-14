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
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { OrderExportPlugin } from '../src/order-export.plugin';
import { FakeExporter } from './fake-exporter';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      OrderExportPlugin.init({
        strategies: [new FakeExporter()],
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [OrderExportPlugin.getUIExtension()],
          devMode: true,
        }),
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
})();
