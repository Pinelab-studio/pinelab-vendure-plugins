import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  KlaviyoPlugin,
  createRefundHandler,
  defaultOrderPlacedEventHandler,
} from '../src';
import { mockCustomEventHandler } from './mock-custom-event-handler';

(async () => {
  require('dotenv').config();
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    authOptions: {
      tokenMethod: ['bearer', 'cookie'],
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [
      KlaviyoPlugin.init({
        apiKey: process.env.KLAVIYO_PRIVATE_API_KEY!,
        eventHandlers: [
          defaultOrderPlacedEventHandler,
          mockCustomEventHandler,
          createRefundHandler({
            getPaymentMethodName: (payment) => {
              // This sample gets the payment method (like 'iDeal') when a the settled payment was a Mollie payment
              return payment?.metadata.method;
            },
          }),
        ],
        feed: {
          // The feed is secured by a password, to prevent abuse, but still able to use it via the shop API in your storefront build.
          password: 'some_password',
          enhanceProductFeedItemFn: (ctx, variant, feedItem) => {
            const asset =
              variant.product.featuredAsset ?? variant.featuredAsset;
            return {
              ...feedItem,
              image_link: `https://my-storefront.io/assets/${asset?.preview}`,
              link: `https://my-storefront.io/product/${variant.product.slug}`,
              // You can add any custom fields you want to the feed item, like so:
              myCustomField: 'Testing',
              // or override any of the default fields, like so:
              name: variant.product.name + ' - Buy Now!',
            };
          },
        },
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
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
  });
  const order = await createSettledOrder(shopClient, 1);
  console.log(`Created settled order '${order.code}'`);
})();
