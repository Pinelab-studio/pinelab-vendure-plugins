import { initialData } from '../../test/src/initial-data';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  JobQueueService,
  RequestContextService,
  VendureConfig,
} from '@vendure/core';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import { InvoiceService } from '../src';
import { createSettledOrder } from '../../test/src/shop-utils';
import { config } from './vendure-config';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const { server, adminClient, shopClient } = createTestEnvironment(
    config as Required<VendureConfig>
  );
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
  // Add default config
  const ctx = await server.app.get(RequestContextService).create({
    apiType: 'admin',
  });
  await server.app.get(InvoiceService).upsertConfig(ctx, { enabled: true });
  // Add test orders at every server start
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await addShippingMethod(adminClient, 'manual-fulfillment');
  const orders = 1;
  for (let i = 1; i <= orders; i++) {
    await createSettledOrder(
      shopClient,
      3,
      undefined,
      undefined,
      {
        input: {
          fullName: 'Pinelab Finance Department',
          streetLine1: 'Bankstreet',
          streetLine2: '899',
          city: 'Leeuwarden',
          postalCode: '233 DE',
          countryCode: 'NL',
        },
      },
      {
        input: {
          fullName: 'Martijn Pinelab',
          streetLine1: 'Pinestreet',
          streetLine2: '16',
          city: 'Leeuwarden',
          postalCode: '736 XX',
          countryCode: 'NL',
        },
      }
    );
  }
  console.log(`Created ${orders} orders`);
})();
