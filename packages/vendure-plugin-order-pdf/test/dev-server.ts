import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  RequestContextService,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { PDFTemplatePlugin } from '../src';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PDFTemplateService } from '../src/api/pdf-template.service';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      PDFTemplatePlugin.init({}),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [PDFTemplatePlugin.ui],
          devMode: true,
        }),
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    apiOptions: {
      adminApiPlayground: true,
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
  // add a template
  const ctx = await server.app.get(RequestContextService).create({
    apiType: 'admin',
  });
  await server.app.get(PDFTemplateService).createPDFTemplate(ctx, {
    enabled: true,
    name: 'Testing',
    templateString: 'Testing',
  });
  // // Add a testorders at every server start
  // await new Promise((resolve) => setTimeout(resolve, 3000));
  // await addShippingMethod(adminClient as any, 'manual-fulfillment');
  // const orders = 3;
  // for (let i = 1; i <= orders; i++) {
  //   await createSettledOrder(shopClient as any, 3);
  // }
  // console.log(`Created ${orders} orders`);
})();
