import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { RequestContextService, VendureConfig } from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import { createSettledOrder } from '../../test/src/shop-utils';
import { OrderPDFsService } from '../src/api/order-pdfs.service';
import { defaultTemplate } from '../src/default-template';
import { config } from './vendure-config';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

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
  });
  const ctx = await server.app.get(RequestContextService).create({
    apiType: 'admin',
  });
  await server.app.get(OrderPDFsService).createPDFTemplate(ctx, {
    enabled: true,
    public: true,
    name: 'Default',
    templateString: defaultTemplate,
  });
  await addShippingMethod(adminClient as any, 'manual-fulfillment');
  await createSettledOrder(shopClient as any, 3);
})();
