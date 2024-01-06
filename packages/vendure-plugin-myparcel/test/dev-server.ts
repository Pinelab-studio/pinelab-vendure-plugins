import { initialData } from '../../test/src/initial-data';
import { MyparcelPlugin } from '../src/myparcel.plugin';
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
  LanguageCode,
  LogLevel,
  mergeConfig,
  PaymentMethodService,
  RequestContext,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import localtunnel from 'localtunnel';
import { MyparcelService } from '../src/api/myparcel.service';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';

require('dotenv').config();

(async () => {
  const tunnel = await localtunnel({ port: 3050 });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: true,
      shopApiPlayground: true,
    },
    customFields: {
      Product: [
        {
          name: 'weight',
          label: [{ value: 'Weight', languageCode: LanguageCode.en }],
          type: 'int',
          ui: { component: 'text-form-input' },
        },
      ],
    },
    plugins: [
      MyparcelPlugin.init({
        vendureHost: tunnel.url,
        getCustomsInformationFn: (orderLine) => {
          return {
            weightInGrams:
              (orderLine.productVariant.product.customFields as any)?.weight ||
              0,
            classification:
              (orderLine.productVariant.product.customFields as any)?.hsCode ||
              '0181',
            countryCodeOfOrigin: 'NL',
          };
        },
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [MyparcelPlugin.ui],
          devMode: true,
        }),
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
    customerCount: 2,
  });
  const channel = await server.app.get(ChannelService).getDefaultChannel();
  const ctx = new RequestContext({
    apiType: 'admin',
    isAuthorized: true,
    authorizedAsOwnerOnly: false,
    channel,
  });
  await server.app
    .get(MyparcelService)
    .upsertConfig(ctx, process.env.MYPARCEL_APIKEY!);
  await server.app.get(PaymentMethodService).create(ctx, {
    code: 'test-payment-method',
    enabled: true,
    handler: {
      code: 'test-payment-method',
      arguments: [],
    },
    translations: [
      {
        name: 'test',
        description: '',
        languageCode: LanguageCode.en_US,
      },
    ],
  });
  // Add a test-order at every server start
  await addShippingMethod(adminClient, 'my-parcel');
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await addItem(shopClient, 'T_1', 1);
  await addItem(shopClient, 'T_2', 2);
  await proceedToArrangingPayment(shopClient, 3, {
    input: {
      fullName: 'Martinho Pinelabio',
      streetLine1: 'Black Bear Rd',
      streetLine2: '14841',
      city: 'West Palm Beach, Florida',
      postalCode: '33419',
      countryCode: 'US',
    },
  });
  await addPaymentToOrder(shopClient, testPaymentMethod.code);
  console.log('Created test order');
})();
