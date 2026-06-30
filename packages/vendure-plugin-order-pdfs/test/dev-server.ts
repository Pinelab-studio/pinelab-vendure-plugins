import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { RequestContextService, VendureConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { OrderPDFsService } from '../src/api/order-pdfs.service';
import { addShippingMethod } from '../../test/src/admin-utils';
import { createSettledOrder } from '../../test/src/shop-utils';
import { defaultTemplate } from '../src/ui/default-template';
import { config } from './vendure-config';

require('dotenv').config();

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
  // add a template
  const ctx = await server.app.get(RequestContextService).create({
    apiType: 'admin',
  });
  await server.app.get(OrderPDFsService).createPDFTemplate(ctx, {
    enabled: true,
    public: true,
    name: 'Default',
    templateString: defaultTemplate,
  });
  // Add a testorders at every server start
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await addShippingMethod(adminClient as any, 'manual-fulfillment');
  const orders = 3;
  for (let i = 1; i <= orders; i++) {
    await createSettledOrder(shopClient as any, 3);
  }
  console.log(`Created ${orders} orders`);
})();
