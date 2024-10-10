import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  AdministratorService,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import path from 'path';
import { AdminSocialAuthPlugin } from '../src';
import { initialData } from '../../test/src/initial-data';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      AdminSocialAuthPlugin.init({
        google: {
          oAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        },
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 5001,
        route: 'admin',
        adminUiConfig: {
          loginUrl: '/social-auth/login',
          brand: 'Pinelab',
          hideVendureBranding: false,
          hideVersion: false,
        },
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
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
