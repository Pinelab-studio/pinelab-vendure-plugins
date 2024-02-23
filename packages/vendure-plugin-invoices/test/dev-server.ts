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
  JobQueueService,
  LogLevel,
  mergeConfig,
  RequestContextService,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import { InvoicePlugin, InvoiceService, LocalFileStrategy } from '../src';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { createSettledOrder } from '../../test/src/shop-utils';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Info }),
    plugins: [
      InvoicePlugin.init({
        vendureHost: 'http://localhost:3050',
        storageStrategy: new LocalFileStrategy(),
        loadDataFn: async (
          ctx,
          injector,
          order,
          mostRecentInvoiceNumber?,
          shouldGenerateCreditInvoice?
        ) => {
          // Increase order number
          let newInvoiceNumber = mostRecentInvoiceNumber || 0;
          newInvoiceNumber += 1;
          const orderDate = order.orderPlacedAt
            ? new Intl.DateTimeFormat('nl-NL').format(order.orderPlacedAt)
            : new Intl.DateTimeFormat('nl-NL').format(order.updatedAt);
          if (shouldGenerateCreditInvoice) {
            // Create credit invoice
            const { previousInvoice, reversedOrderTotals } =
              shouldGenerateCreditInvoice;
            return {
              orderDate,
              invoiceNumber: newInvoiceNumber,
              isCreditInvoice: true,
              // Reference to original invoice because this is a credit invoice
              originalInvoiceNumber: previousInvoice.invoiceNumber,
              order: {
                ...order,
                total: reversedOrderTotals.total,
                totalWithTax: reversedOrderTotals.totalWithTax,
                taxSummary: reversedOrderTotals.taxSummaries,
              },
            };
          } else {
            // Normal debit invoice
            return {
              orderDate,
              invoiceNumber: newInvoiceNumber,
              order: order,
            };
          }
        },
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [InvoicePlugin.ui],
          devMode: true,
        }),
      }),
    ],
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
  // Add a test orders at every server start
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await addShippingMethod(adminClient as any, 'manual-fulfillment');
  const orders = 1;
  for (let i = 1; i <= orders; i++) {
    await createSettledOrder(shopClient as any, 3);
  }
  console.log(`Created ${orders} orders`);
})();
