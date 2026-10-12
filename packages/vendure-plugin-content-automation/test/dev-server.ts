import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { VendureConfig } from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { runContentAutomationPopulation } from '../src';
import { config } from './vendure-config';

/**
 * The dev-server is just for development. Feel free to break anything here.
 */
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server } = createTestEnvironment(config as Required<VendureConfig>);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  // Populate some demo updates for the dashboard
  await runContentAutomationPopulation(server.app);
})();
