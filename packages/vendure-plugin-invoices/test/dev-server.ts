import { initialData } from '../../test/src/initial-data';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  ChannelService,
  DefaultLogger,
  DefaultSearchPlugin,
  Injector,
  JobQueueService,
  LogLevel,
  mergeConfig,
  RequestContext,
  RequestContextService,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import {
  ExactOnlineStrategy,
  InvoicePlugin,
  InvoiceService,
  LocalFileStrategy,
  XeroUKExportStrategy,
} from '../src';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { createSettledOrder } from '../../test/src/shop-utils';
import { INestApplication } from '@nestjs/common';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      InvoicePlugin.init({
        vendureHost: 'http://localhost:3050',
        storageStrategy: new LocalFileStrategy(),
        licenseKey: process.env.LICENSE_KEY!,
        // licenseKey: 'false license key',
        startInvoiceNumber: Math.floor(100000 + Math.random() * 900000), // Random 6 digit number to prevent duplicates in Xero
        accountingExports: [
          new XeroUKExportStrategy({
            clientId: process.env.XERO_CLIENT_ID!,
            clientSecret: process.env.XERO_CLIENT_SECRET!,
            shippingAccountCode: '0103',
            salesAccountCode: '0102',
            invoiceBrandingThemeId: '62f2bce1-32c4-4e8d-a9b1-87060fb7c791',
            getReference: () =>
              'THIS IS A TEST INVOICE, DONT APPROVE THIS PLEASE.',
            getVendureUrl: (order) =>
              `https://pinelab.studio/order/${order.code}`,
            getDueDate: (ctx, order, invoice) => {
              const payment = order.payments.find((p) => p.state === 'Settled');
              if (payment?.method === 'purchase-order') {
                const date = new Date();
                date.setDate(date.getDate() + 30); //30 days later
                return date;
              } else {
                return new Date();
              }
            },
          }),
        ],
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        // app: compileUiExtensions({
        //   outputPath: path.join(__dirname, '__admin-ui'),
        //   extensions: [InvoicePlugin.ui],
        //   devMode: true,
        // }),
      }),
    ],
    customFields: {
      Channel: [
        {
          name: 'exactRefreshToken',
          type: 'string',
          public: false,
          readonly: true,
        },
      ],
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    apiOptions: {
      adminApiPlayground: true,
      shopApiPlayground: true,
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
  const jobQueueService = server.app.get(JobQueueService);
  await jobQueueService.start();
  // add default Config
  const ctx = await server.app.get(RequestContextService).create({
    apiType: 'admin',
  });
  await server.app.get(InvoiceService).upsertConfig(ctx, { enabled: true });

  // Test Exact Online setup
  await testExactOnlineSetup(server.app);

  // Add a test orders at every server start
  // await new Promise((resolve) => setTimeout(resolve, 3000));
  // await addShippingMethod(adminClient, 'manual-fulfillment');
  // const orders = 1;
  // for (let i = 1; i <= orders; i++) {
  //   await createSettledOrder(
  //     shopClient,
  //     3,
  //     undefined,
  //     undefined,
  //     {
  //       input: {
  //         fullName: 'Pinelab Finance Department',
  //         streetLine1: 'Bankstreet',
  //         streetLine2: '899',
  //         city: 'Leeuwarden',
  //         postalCode: '233 DE',
  //         countryCode: 'NL',
  //       },
  //     },
  //     {
  //       input: {
  //         fullName: 'Martijn Pinelab',
  //         streetLine1: 'Pinestreet',
  //         streetLine2: '16',
  //         city: 'Leeuwarden',
  //         postalCode: '736 XX',
  //         countryCode: 'NL',
  //       },
  //     }
  //   );
  // }
  // console.log(`Created ${orders} orders`);
})();

export async function testExactOnlineSetup(app: INestApplication<unknown>) {
  const ctx = await app.get(RequestContextService).create({
    apiType: 'admin',
    channelOrToken: E2E_DEFAULT_CHANNEL_TOKEN,
  });
  const exact = new ExactOnlineStrategy({
    channelToken: 'your-channel-token', // Or undefined if you want to use this strategy for all Channels
    clientId: process.env.EXACT_CLIENT_ID!,
    clientSecret: process.env.EXACT_CLIENT_SECRET!,
    redirectUri: process.env.EXACT_REDIRECT_URI!,
  });
  await exact.setupExactAuth(ctx, app);
}
