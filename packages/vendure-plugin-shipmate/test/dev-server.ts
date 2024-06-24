require('dotenv').config();
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  ChannelService,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  RequestContext,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { ShipmatePlugin } from '../src/shipmate.plugin';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler/';
import path from 'node:path';
import { ShipmateConfigService } from '../src/api/shipmate-config.service';
import { createSettledOrder } from '../../test/src/shop-utils';

(async () => {
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      ShipmatePlugin.init({
        apiUrl: process.env.SHIPMATE_BASE_URL as any,
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [ShipmatePlugin.ui],
          devMode: true,
        }),
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
    authOptions: {
      tokenMethod: 'bearer',
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
  });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const { server, shopClient } = createTestEnvironment(config);
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
    customerCount: 5,
  });
  const channel = await server.app.get(ChannelService).getDefaultChannel();
  const ctx = new RequestContext({
    apiType: 'admin',
    isAuthorized: true,
    authorizedAsOwnerOnly: false,
    channel,
  });
  const result = await server.app
    .get(ShipmateConfigService)
    .upsertConfig(
      ctx,
      process.env.SHIPMATE_API_KEY!,
      process.env.SHIPMATE_USERNAME!,
      process.env.SHIPMATE_PASSWORD!,
      [
        process.env.SHIPMATE_WEBHOOK_AUTH_TOKEN1!,
        process.env.SHIPMATE_WEBHOOK_AUTH_TOKEN2!,
      ]
    );
  console.log('Created Shipmate Config');
  const res = await createSettledOrder(
    shopClient,
    1,
    true,
    undefined,
    undefined,
    {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: 'SA35 0AE',
        countryCode: 'GB',
      },
    }
  );
  console.log(`Placed order ${res.code}`);
})();
