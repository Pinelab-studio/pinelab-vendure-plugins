import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import path from 'path';
import { AdminSocialAuthPlugin } from '../src';
import { initialData } from '../../test/src/initial-data';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      AssetServerPlugin.init({
        assetUploadDir: path.join(__dirname, '__data__/assets'),
        route: 'assets',
    }),
    AdminSocialAuthPlugin.init({
        adminLoginProviders: [{
          googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        }],
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 5001,
        route: 'admin',
        adminUiConfig: {
            loginUrl: '/social-auth/login',
        },
        /*      
        TODO: uncomment this block to start the admin ui in dev mode
        app: compileUiExtensions({
          outputPath: path.join(__dirname, "__admin-ui"),
          extensions: [
            // TODO Add your plugin's UI here
          ],
          devMode: true
        })*/
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
})();
