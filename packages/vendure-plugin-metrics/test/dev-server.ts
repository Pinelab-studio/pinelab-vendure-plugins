import { VendureConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { MetricsService } from '../src';
import { config } from './vendure-config';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  require('dotenv').config();
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // testConfig sets cors: true, allow the Vite dev server instead
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };
  const { server, shopClient } = createTestEnvironment(
    config as Required<VendureConfig>,
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
  for (let i = 0; i < 5; i++) {
    await createSettledOrder(shopClient, 1);
  }
  // Generate charts right away, instead of waiting for the nightly task
  await server.app.get(MetricsService).generateAllCharts();
})();
