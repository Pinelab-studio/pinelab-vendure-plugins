import { DefaultLogger, EventBus, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { EventCreateQueryV2 } from 'klaviyo-api';
import nock from 'nock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  createRefundHandler,
  defaultOrderPlacedEventHandler,
  KlaviyoPlugin,
} from '../src';
import { mockOrderPlacedHandler } from './mock-order-placed-handler';
import { mockCustomEventHandler } from './mock-custom-event-handler';
import { CheckoutStartedEvent, startedCheckoutHandler } from '../src/';
import gql from 'graphql-tag';
import { waitFor } from '../../test/src/test-helpers';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      KlaviyoPlugin.init({
        apiKey: 'some_private_api_key',
        eventHandlers: [
          defaultOrderPlacedEventHandler,
          startedCheckoutHandler,
          createRefundHandler({
            getPaymentMethodName: (payment) => `test-${payment?.id}`,
          }),
          mockOrderPlacedHandler,
          mockCustomEventHandler,
        ],
        feed: {
          password: 'test',
          enhanceProductFeedItemFn: (ctx, variant, feedItem) => {
            console.log('enhanceProductFeedItemFn stockelvvess', feedItem);
            const asset =
              variant.product.featuredAsset ?? variant.featuredAsset;
            return {
              ...feedItem,
              image_link: `https://my-storefront.io/assets/${asset?.preview}`,
              link: `https://my-storefront.io/product/${variant.product.slug}`,
            };
          },
        },
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
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
    customerCount: 2,
  });
  await adminClient.asSuperAdmin();
}, 30000);

afterAll(async () => {
  await server.destroy();
}, 100000);

describe('Klaviyo', () => {
  // Intercepted all requests to Klaviyo
  const klaviyoRequests: EventCreateQueryV2[] = [];
  nock('https://a.klaviyo.com/api/')
    .post('/events', (reqBody) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      klaviyoRequests.push(reqBody);
      return true;
    })
    .reply(200, {})
    .persist();

  it('Started the server', () => {
    expect(server.app.getHttpServer()).toBeDefined();
  });

  it('Places an order', async () => {
    const order = await createSettledOrder(shopClient, 1);
    // Give worker some time to send event to klaviyo
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(order.code).toBeDefined();
  });

  it("Has sent 'Placed Order Event' to Klaviyo", () => {
    const orderEvent = klaviyoRequests.find(
      (r) => r.data.attributes.metric.data.attributes.name === 'Placed Order'
    );
    const attributes = orderEvent?.data.attributes as any;
    expect(attributes.properties.OrderId).toBeDefined();
    expect(attributes.properties.ItemNames).toEqual([
      'Laptop 13 inch 8GB',
      'Laptop 15 inch 8GB',
    ]);
    const time = new Date(attributes.time!).getTime();
    expect(isNaN(time)).toBe(false); // Should be valid date
    expect(attributes?.value).toBe(4921.4);
    expect(attributes?.unique_id).toBeDefined();
    const orderItem = (orderEvent?.data.attributes.properties as any).Items[0];
    expect(orderItem.ProductID).toBeDefined();
    expect(orderItem.SKU).toBe('L2201308');
    expect(orderItem.ProductName).toBe('Laptop 13 inch 8GB');
    expect(orderItem.Quantity).toBe(1);
    expect(orderItem.ItemPrice).toBe(1558.8);
    expect(orderItem.RowTotal).toBe(1558.8);
    const profile = orderEvent?.data.attributes.profile.data.attributes as any;
    expect(profile.email).toBe('hayden.zieme12@hotmail.com');
    expect(profile.external_id).toBe('1');
    expect(profile.first_name).toBe('Hayden');
    expect(profile.last_name).toBe('Zieme');
    expect(profile.location.address1).toBe('Verzetsstraat');
    expect(profile.location.address2).toBe('12a');
    expect(profile.location.city).toBe('Liwwa');
    expect(profile.location.country).toBe('NL');
  });

  it("Has sent 'Ordered Product' to Klaviyo", () => {
    const productEvent = klaviyoRequests.filter(
      (r) => r.data.attributes.metric.data.attributes.name === 'Ordered Product'
    );
    const orderItem1 = productEvent[0].data.attributes.properties as any;
    const orderItem2 = productEvent[1].data.attributes.properties as any;
    expect(orderItem1).toEqual({
      ProductID: '1',
      SKU: 'L2201308',
      ProductName: 'Laptop 13 inch 8GB',
      Quantity: 1,
      ItemPrice: 1558.8,
      RowTotal: 1558.8,
    });
    expect(orderItem2).toEqual({
      ProductID: '2',
      SKU: 'L2201508',
      ProductName: 'Laptop 15 inch 8GB',
      Quantity: 2,
      ItemPrice: 1678.8,
      RowTotal: 3357.6,
    });
  });

  it("Has sent 'Custom Order Placed' event to Klaviyo", () => {
    const orderEvents = klaviyoRequests.filter(
      (r) => r.data.attributes.metric.data.attributes.name === 'Placed Order'
    );
    const orderEvent = orderEvents[orderEvents.length - 1]; // Last one should be our custom event
    const properties = orderEvent.data.attributes.properties as any;
    // Only test custom and new properties here
    expect(properties.Categories).toEqual(['Some mock category']);
    expect(properties.Brands).toEqual(['Test Brand']);
    expect(properties.CustomProperties).toEqual({
      customOrderProp: 'my custom order value',
    });
    expect(properties.Items[0].customProperties).toEqual({
      customOrderItemProp: 'my custom order item value',
    });
    expect(properties.Items[0].ProductURL).toBe(
      'https://pinelab.studio/product/some-product'
    );
    expect(properties.Items[0].ImageURL).toBe('custom-image-url.png');
  });

  it("Has not sent 'Ordered Product' events for our custom Order Placed handler", () => {
    // Because we've set `excludeFromOrderedProductEvent=true` on all order items
    const orderedProductEvents = klaviyoRequests.filter(
      (r) =>
        r.data.attributes.metric.data.attributes.name === 'Ordered Product' &&
        r.data
    );
    // Only expect the 2 events from the default handler, no more
    expect(orderedProductEvents.length).toBe(2);
  });

  it("Has sent 'Custom Order Placed' event to Klaviyo", () => {
    const customEvent = klaviyoRequests.find(
      (r) =>
        r.data.attributes.metric.data.attributes.name === 'Custom Testing Event'
    );
    expect(
      (customEvent?.data.attributes.properties as any).customTestEventProp
    ).toEqual('some information');
  });

  it("Has sent 'Refund Created' event to Klaviyo when an order is refunded", async () => {
    await adminClient.asSuperAdmin();
    adminClient.query(
      gql`
        mutation RefundOrder($input: RefundOrderInput!) {
          refundOrder(input: $input) {
            ... on Refund {
              id
            }
          }
        }
      `,
      {
        input: {
          reason: 'Customer request',
          paymentId: 'T_1',
          amount: 500,
          shipping: 0,
          adjustment: 0,
        },
      }
    );
    const refundEvent = await waitFor(
      () =>
        klaviyoRequests.find(
          (r) =>
            r.data.attributes.metric.data.attributes.name === 'Refund Created'
        ),
      100
    );
    expect(refundEvent).toBeDefined();
    const properties = refundEvent.data.attributes.properties as any;
    expect(properties.paymentMethodName).toEqual('test-1');
    expect(properties.refundAmount).toEqual(500);
    expect(properties.refundReason).toEqual('Customer request');
  });

  it('Emits CheckoutStartedEvent on calling checkoutStarted() mutation', async () => {
    // Create active order
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    await addItem(shopClient, 'T_1', 1);
    const events: CheckoutStartedEvent[] = [];
    server.app
      .get(EventBus)
      .ofType(CheckoutStartedEvent)
      .subscribe((e) => events.push(e));
    await shopClient.query(
      gql`
        mutation {
          klaviyoCheckoutStarted
        }
      `
    );
    // Give worker some time to send event to klaviyo
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const checkoutStartedEvent = klaviyoRequests.find(
      (r) =>
        r.data.attributes.metric.data.attributes.name === 'Checkout Started'
    );
    expect(events[0].order.id).toBeDefined();
    const profile = checkoutStartedEvent?.data.attributes.profile.data
      .attributes as any;
    expect(profile.email).toBe('hayden.zieme12@hotmail.com');
    expect(checkoutStartedEvent).toBeDefined();
  });

  it('Does not allow signup for unauthenticated calls', async () => {
    await shopClient.asAnonymousUser();
    const signUpPromise = shopClient.query(
      gql`
        mutation {
          subscribeToKlaviyoList(
            emailAddress: "testing@pinelab.studio"
            listId: "test-list-id"
          )
        }
      `
    );
    expect(signUpPromise).rejects.toThrow(
      'You are not currently authorized to perform this action'
    );
  });

  it('Sign up to list', async () => {
    // Create active order
    await shopClient.asAnonymousUser();
    await addItem(shopClient, 'T_1', 1);
    // Mock API response
    let signupRequest: any;
    nock('https://a.klaviyo.com/api/')
      .post('/profile-subscription-bulk-create-jobs', (reqBody) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        signupRequest = reqBody;
        return true;
      })
      .reply(200, {})
      .persist();
    await shopClient.query(
      gql`
        mutation {
          subscribeToKlaviyoList(
            emailAddress: "testing@pinelab.studio"
            listId: "test-list-id"
          )
        }
      `
    );
    expect(
      signupRequest.data.attributes.profiles.data[0].attributes.email
    ).toBe('testing@pinelab.studio');
    expect(signupRequest.data.relationships.list.data.id).toBe('test-list-id');
  });

  it('Does not allow access to product feed with wrong password', async () => {
    await shopClient.asAnonymousUser();
    const promise = shopClient.query(
      gql`
        query {
          klaviyoProductFeed(password: "wrong-password")
        }
      `
    );
    expect(promise).rejects.toThrow(
      'You are not currently authorized to perform this action'
    );
  });

  it('Get product feed via GraphQL', async () => {
    await shopClient.asAnonymousUser();

    const { klaviyoProductFeed } = await shopClient.query(
      gql`
        query {
          klaviyoProductFeed(password: "test")
        }
      `
    );

    expect(klaviyoProductFeed).toBeDefined();
    expect(typeof klaviyoProductFeed).toBe('string');

    // Parse the JSON feed to verify structure
    const productFeed = JSON.parse(klaviyoProductFeed);
    expect(Array.isArray(productFeed)).toBe(true);
    expect(productFeed.length).toBeGreaterThan(0);
    // Verify all products in feed have required structure
    productFeed.forEach((item: any) => {
      expect(typeof item.id).toBe('string');
      expect(typeof item.title).toBe('string');
      expect(typeof item.link).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(typeof item.price).toBe('number');
      expect(typeof item.image_link).toBe('string');
      expect(Array.isArray(item.categories)).toBe(true);
      expect(typeof item.inventory_quantity).toBe('number');
      expect(typeof item.inventory_policy).toBe('number');
    });
    expect(productFeed[0]).toEqual({
      id: '1',
      title: 'Laptop 13 inch 8GB',
      description:
        'Now equipped with seventh-generation Intel Core processors, Laptop is snappier than ever. From daily tasks like launching apps and opening files to more advanced computing, you can power through your day thanks to faster SSDs and Turbo Boost processing up to 3.6GHz.',
      image_link: 'https://my-storefront.io/assets/undefined', // undefined because no assets in test data
      link: 'https://my-storefront.io/product/laptop',
      price: 1558.8,
      categories: ['Electronics'],
      inventory_quantity: 100,
      inventory_policy: 1,
    });
  });

  it('Subscribe to back in stock notification', async () => {
    await shopClient.asAnonymousUser();
    await addItem(shopClient, 'T_1', 1); // Create session
    // Mock API response for back-in-stock subscription
    let backInStockRequest: any;
    nock('https://a.klaviyo.com/api/')
      .post('/back-in-stock-subscriptions', (reqBody) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        backInStockRequest = reqBody;
        return true;
      })
      .reply(200, {})
      .persist();

    await shopClient.query(
      gql`
        mutation {
          subscribeToKlaviyoBackInStock(
            emailAddress: "test@example.com"
            catalogItemId: "1"
          )
        }
      `
    );
    console.log('backInStockRequest', backInStockRequest);

    // Verify the request body matches the expected structure
    expect(backInStockRequest).toBeDefined();
    expect(backInStockRequest.data.type).toBe('back-in-stock-subscription');
    expect(backInStockRequest.data.attributes.profile.data.type).toBe(
      'profile'
    );
    expect(
      backInStockRequest.data.attributes.profile.data.attributes.email
    ).toBe('test@example.com');
    expect(backInStockRequest.data.attributes.channels).toEqual(['EMAIL']);
    expect(backInStockRequest.data.relationships.variant.data.type).toBe(
      'catalog-variant'
    );
    expect(backInStockRequest.data.relationships.variant.data.id).toBe(
      '$custom:::$default:::1'
    );
  });

  it('Does not allow back-in-stock subscription for unauthenticated calls', async () => {
    await shopClient.asAnonymousUser();
    const backInStockPromise = shopClient.query(
      gql`
        mutation {
          subscribeToKlaviyoBackInStock(
            emailAddress: "test@example.com"
            catalogItemId: "1"
          )
        }
      `
    );
    expect(backInStockPromise).rejects.toThrow(
      'You are not currently authorized to perform this action'
    );
  });
});
