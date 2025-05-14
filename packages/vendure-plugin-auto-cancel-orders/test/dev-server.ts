import {
  bootstrap,
  DefaultJobQueuePlugin,
  DefaultSearchPlugin,
  InitialData,
  VendureConfig,
} from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import { AutoCancelOrdersPlugin } from '../src/auto-cancel-orders.plugin';
import path from 'path';

/**
 * This dev server script is useful for testing the plugin during development.
 * It starts a Vendure server with the plugin configured and some test data.
 */
async function runDevServer() {
  const config: VendureConfig = {
    apiOptions: {
      port: 3000,
      adminApiPath: 'admin-api',
      shopApiPath: 'shop-api',
      adminApiPlayground: true,
      shopApiPlayground: true,
    },
    authOptions: {
      superadminCredentials: {
        identifier: 'superadmin',
        password: 'superadmin',
      },
      cookieOptions: {
        secret: 'dev-server-cookie-secret',
      },
    },
    dbConnectionOptions: {
      type: 'better-sqlite3',
      filename: path.join(__dirname, 'vendure.sqlite'),
      synchronize: true,
    },
    plugins: [
      DefaultJobQueuePlugin,
      DefaultSearchPlugin,
      AutoCancelOrdersPlugin,
    ],
  };

  const { server, adminClient, shopClient } = await createTestEnvironment(
    config
  );
  await server.init({
    initialData: {
      defaultLanguage: 'en',
      defaultZone: 'Europe/Amsterdam',
      countries: [
        { name: 'Netherlands', code: 'NL', zone: 'Europe/Amsterdam' },
      ],
      currencies: [{ code: 'EUR', symbol: '€' }],
    } as InitialData,
    productsCsvPath: path.join(__dirname, 'products.csv'),
  });

  return { server, adminClient, shopClient };
}

runDevServer()
  .then(({ server }) => {
    console.log('Dev server is now running on http://localhost:3000');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
