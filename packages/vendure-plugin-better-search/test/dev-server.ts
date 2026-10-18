import { VendureConfig } from '@vendure/core';
import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import dotenv from 'dotenv';
import { config } from './vendure-config';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  dotenv.config();
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const { server } = createTestEnvironment(config as Required<VendureConfig>);
  await server.init({
    initialData,
    productsCsvPath: './test/search-products.csv',
  });
})();
