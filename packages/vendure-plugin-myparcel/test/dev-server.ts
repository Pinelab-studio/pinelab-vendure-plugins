import { initialData } from '../../test/src/initial-data';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  ChannelService,
  LanguageCode,
  PaymentMethodService,
  RequestContext,
  VendureConfig,
} from '@vendure/core';
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import localtunnel from 'localtunnel';
import { MyparcelPlugin } from '../src/myparcel.plugin';
import { config } from './vendure-config';

require('dotenv').config();

(async () => {
  const tunnel = await localtunnel({ port: 3050 });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override the placeholder host from vendure-config.ts now that we have a real tunnel URL
  MyparcelPlugin.init({ ...MyparcelPlugin.config, vendureHost: tunnel.url });
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, adminClient, shopClient } = createTestEnvironment(
    config as Required<VendureConfig>
  );
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
  await server.app.get(ChannelService).update(ctx, {
    id: ctx.channelId,
    customFields: {
      myparcelEnabled: true,
      myparcelApiKey: process.env.MYPARCEL_APIKEY!,
    },
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
