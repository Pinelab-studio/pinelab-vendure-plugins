import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import { AdministratorService, VendureConfig } from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { config } from './vendure-config';

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
  const ctx = await getSuperadminContext(server.app);
  const result = await server.app.get(AdministratorService).create(ctx, {
    emailAddress: 'martijn@pinelab.studio',
    firstName: 'Martijn',
    lastName: 'Pinelab',
    roleIds: ['1'],
    password: 'test',
  });

  console.log(`Created admin user ${result.emailAddress}`);
})();
