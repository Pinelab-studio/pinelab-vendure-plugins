import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  ChannelService,
  InitialData,
  LanguageCode,
  PaymentMethodService,
  RequestContext,
  TaxRateService,
  VendureConfig,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { config } from './vendure-config';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, shopClient } = createTestEnvironment(
    config as Required<VendureConfig>
  );
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
  await server.app.get(ChannelService).update(ctx, {
    id: ctx.channelId,
    customFields: {
      eBoekhoudenEnabled: true,
      eBoekhoudenAccount: '1010',
      eBoekhoudenContraAccount: '8010',
      eBoekhoudenUsername: process.env.EBOEKHOUDEN_USERNAME!,
      eBoekhoudenSecret1: process.env.EBOEKHOUDEN_SECRET1!,
      eBoekhoudenSecret2: process.env.EBOEKHOUDEN_SECRET2!,
    },
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
  // await addPaymentToOrder(shopClient, testPaymentMethod.code);
})();
