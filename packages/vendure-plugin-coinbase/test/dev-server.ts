import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
  mergeConfig,
  ProductVariantPrice,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { initialData } from '../../test/src/initial-data';
import { CoinbasePlugin } from '../src/coinbase.plugin';
import { Connection } from 'typeorm';
import { addItem, setAddressAndShipping } from '../../test/src/shop-utils';
import { CreatePaymentIntentMutation } from './queries';
import {
  CreatePaymentMethod,
  LanguageCode,
} from '../../test/src/generated/admin-graphql';
import { coinbaseHandler } from '../src/coinbase.handler';
import { addShippingMethod } from '../../test/src/admin-utils';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
    plugins: [
      CoinbasePlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  // Add CoinBase payment
  await adminClient.asSuperAdmin();
  await adminClient.query(CreatePaymentMethod, {
    input: {
      code: 'coinbase-payment',
      enabled: true,
      handler: {
        code: coinbaseHandler.code,
        arguments: [
          { name: 'redirectUrl', value: 'https://minishop.studio/order' },
          { name: 'apiKey', value: process.env.COINBASE_APIKEY },
        ],
      },
      translations: [
        {
          name: 'Coinbase payment test',
          description: 'This is a Coinbase test payment method',
          languageCode: LanguageCode.EnUs,
        },
      ],
    },
  });
  // Set price of variant T_1 to 0.01
  await server.app
    .get(Connection)
    .getRepository(ProductVariantPrice)
    .update({ id: 1 }, { price: 300 });
  console.log('Set variant T_1 to 3.00');
  // Create Free shippingmethod
  await addShippingMethod(adminClient, 'manual-fulfillment', '0');
  console.log('Created shippingMethod with $0');
  // Create order
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  let order = await addItem(shopClient, 'T_1', 1);
  await setAddressAndShipping(shopClient, 'T_3');
  console.log('Created order with item and shipping');
  const { createCoinbasePaymentIntent } = await shopClient.query(
    CreatePaymentIntentMutation
  );
  console.log(`Pay with crypto on ${createCoinbasePaymentIntent}`);
})();
