require('dotenv').config();
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  ChannelService,
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
  mergeConfig,
  PaymentMethodService,
  RequestContext,
  LanguageCode,
  TaxRateService,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { EBoekhoudenPlugin } from '../src';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { EBoekhoudenService } from '../src/api/e-boekhouden.service';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      EBoekhoudenPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        /*        app: compileUiExtensions({
          outputPath: path.join(__dirname, "__admin-ui"),
          extensions: [EBoekhoudenPlugin.ui],
          devMode: true
        })*/
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
  });
  const { server, shopClient } = createTestEnvironment(config);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  // Prepare test data
  const channel = await server.app.get(ChannelService).getDefaultChannel();
  const ctx = new RequestContext({
    apiType: 'admin',
    isAuthorized: true,
    authorizedAsOwnerOnly: false,
    channel,
  });
  await server.app.get(PaymentMethodService).create(ctx, {
    code: 'test-payment-method',
    enabled: true,
    handler: {
      code: 'test-payment-method',
      arguments: [],
    },
    translations: [
      {
        languageCode: LanguageCode.en_US,
        description: '',
        name: 'test',
      },
    ],
  });
  await server.app.get(TaxRateService).update(ctx, { id: 2, value: 21 }); // Set europe to 21
  await server.app
    .get(EBoekhoudenService)
    .upsertConfig(E2E_DEFAULT_CHANNEL_TOKEN, {
      enabled: true,
      account: '1010',
      contraAccount: '8010',
      username: process.env.EBOEKHOUDEN_USERNAME!,
      secret1: process.env.EBOEKHOUDEN_SECRET1!,
      secret2: process.env.EBOEKHOUDEN_SECRET2!,
    });
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await addItem(shopClient, 'T_1', 1);
  await addItem(shopClient, 'T_2', 1);
  await proceedToArrangingPayment(shopClient, 1, {
    input: {
      fullName: 'Martinho Pinelabio',
      streetLine1: 'Verzetsstraat',
      streetLine2: '12a',
      city: 'Liwwa',
      postalCode: '8923CP',
      countryCode: 'NL',
    },
  });
  await addPaymentToOrder(shopClient, testPaymentMethod.code);
})();
