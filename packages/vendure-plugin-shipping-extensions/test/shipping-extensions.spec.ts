import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  ProductService,
  ProductVariantService,
  RequestContext,
  roundMoney,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  clearAllTables,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import nock from 'nock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LanguageCode } from '../../test/src/generated/admin-graphql';
import { CreateAddressInput } from '../../test/src/generated/shop-graphql';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { ShippingExtensionsPlugin } from '../src/shipping-extensions.plugin';
import { GeoLocation } from '../src/strategies/order-address-to-geolocation-strategy';
import {
  POSTCODES_URL,
  UKPostalCodeToGelocationConversionStrategy,
} from '../src/strategies/uk-postalcode-to-geolocation-strategy';
import { getDistanceBetweenPointsInKMs } from '../src/util/get-distance-between-points';
import {
  createDistanceBasedShippingMethod,
  createPromotion,
  createShippingMethod,
  DistanceBasedShippingCalculatorOptions,
} from './test-helpers';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;
let ctx: RequestContext;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      ShippingExtensionsPlugin.init({
        orderAddressToGeolocationStrategy:
          new UKPostalCodeToGelocationConversionStrategy(),
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
      shippingMethods: [],
      paymentMethods: [
        {
          name: testPaymentMethod.code,
          handler: { code: testPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
  serverStarted = true;
  ctx = await getSuperadminContext(server.app);
}, 60000);

it('Should start successfully', async () => {
  await expect(serverStarted).toBe(true);
});

describe('Shipping by weight and country', function () {
  it('Creates shippingmethod 1 for NL and BE, with weight between 0 and 100 ', async () => {
    await adminClient.asSuperAdmin();
    const res = await createShippingMethod(adminClient, {
      minWeight: 0,
      maxWeight: 100,
      countries: ['NL', 'BE'],
      rate: 111,
      exclude: false,
    });
    expect(res.code).toBeDefined();
  });

  it('Creates shippingmethod 2 for everything except NL and BE, with weight between 0 and 100 ', async () => {
    await adminClient.asSuperAdmin();
    const res = await createShippingMethod(adminClient, {
      minWeight: 0,
      maxWeight: 100,
      countries: ['NL', 'BE'],
      rate: 222,
      exclude: true,
    });
    expect(res.code).toBeDefined();
  });

  it('Creates shippingmethod 3 for everything except BE, with weight between 150 and 200 ', async () => {
    await adminClient.asSuperAdmin();
    const res = await createShippingMethod(adminClient, {
      minWeight: 0,
      maxWeight: 100,
      countries: ['BE'],
      rate: 333,
      exclude: true,
    });
    expect(res.code).toBeDefined();
  });

  it('Is eligible for method 1 with country NL and weight 0', async () => {
    const order = await createSettledOrder(shopClient, 1);
    expect(order.state).toBe('PaymentSettled');
    expect(order.shippingWithTax).toBe(111);
  });

  it('Is eligible for method 3 with country NL and weight 200', async () => {
    const order = await createSettledOrder(shopClient, 3);
    expect(order.state).toBe('PaymentSettled');
    expect(order.shippingWithTax).toBe(333);
  });

  it('Is eligible for method 1 with country NL and product weight 100', async () => {
    const product = await server.app
      .get(ProductService)
      .update(ctx, { id: 1, customFields: { weight: 25 } });
    expect((product.customFields as any).weight).toBe(25);

    const order = await createSettledOrder(shopClient, 1);
    expect(order.state).toBe('PaymentSettled');
    expect(order.shippingWithTax).toBe(111);
  });

  it('Is eligible for method 1 with country NL and product weight 25 variant weight 50', async () => {
    const product = await server.app
      .get(ProductService)
      .update(ctx, { id: 1, customFields: { weight: 25 } });
    expect((product.customFields as any).weight).toBe(25);

    const productVariants = await server.app
      .get(ProductVariantService)
      .update(ctx, [{ id: 1, customFields: { weight: 50 } }]);
    expect(productVariants.length).toBe(1);
    expect((productVariants[0].customFields as any).weight).toBe(50);

    const order = await createSettledOrder(shopClient, 1);
    expect(order.state).toBe('PaymentSettled');
    expect(order.shippingWithTax).toBe(111);
  });

  it('Is eligible for method 1 with country NL and product weight 50 variant weight 0', async () => {
    const product = await server.app
      .get(ProductService)
      .update(ctx, { id: 1, customFields: { weight: 50 } });
    expect((product.customFields as any).weight).toBe(50);

    const productVariants = await server.app
      .get(ProductVariantService)
      .update(ctx, [{ id: 1, customFields: { weight: 0 } }]);
    expect(productVariants.length).toBe(1);
    expect((productVariants[0].customFields as any).weight).toBe(0);
    const order = await createSettledOrder(shopClient, 1);
    expect(order.state).toBe('PaymentSettled');
    expect(order.shippingWithTax).toBe(111);
  });

  it('Is NOT eligible for method 2 with country NL', async () => {
    await expect(createSettledOrder(shopClient, 2)).rejects.toThrow(
      'ORDER_STATE_TRANSITION_ERROR',
    );
  });

  it('Is NOT eligible for method 1 and 2 with weight 200', async () => {
    const product = await server.app
      .get(ProductService)
      .update(ctx, { id: 1, customFields: { weight: 200 } });
    expect((product.customFields as any).weight).toBe(200);
    await expect(createSettledOrder(shopClient, 1)).rejects.toThrow(
      'ORDER_STATE_TRANSITION_ERROR',
    );
    await expect(createSettledOrder(shopClient, 2)).rejects.toThrow(
      'ORDER_STATE_TRANSITION_ERROR',
    );
  });

  it('Is NOT eligible for method 1 and 2 with variant weight 200', async () => {
    const product = await server.app
      .get(ProductService)
      .update(ctx, { id: 1, customFields: { weight: 0 } });
    expect((product.customFields as any).weight).toBe(0);

    const productVariants = await server.app
      .get(ProductVariantService)
      .update(ctx, [{ id: 1, customFields: { weight: 200 } }]);
    expect(productVariants.length).toBe(1);
    expect((productVariants[0].customFields as any).weight).toBe(200);

    await expect(createSettledOrder(shopClient, 1)).rejects.toThrow(
      'ORDER_STATE_TRANSITION_ERROR',
    );
    await expect(createSettledOrder(shopClient, 2)).rejects.toThrow(
      'ORDER_STATE_TRANSITION_ERROR',
    );
  });
});

describe('Distance based shipping calculator', function () {
  it('Should calculate distance based Shipping Price', async () => {
    const shippingAddressPostalCode = 'SW1W 0NY';
    const shippingAddressGeoLocation: GeoLocation = {
      longitude: -0.147421,
      latitude: 51.495373,
    };
    const storeGeoLocation: GeoLocation = {
      latitude: 51.5072,
      longitude: -0.118092,
    };
    const shippingAdress: CreateAddressInput = {
      countryCode: 'GB',
      streetLine1: 'London Street',
      postalCode: shippingAddressPostalCode,
    };
    nock(POSTCODES_URL)
      .get(`/${shippingAddressPostalCode}`)
      .reply(200, {
        data: {
          status: 200,
          result: {
            postcode: shippingAddressPostalCode,
            longitude: shippingAddressGeoLocation.longitude,
            latitude: shippingAddressGeoLocation.latitude,
          },
        },
      });
    const priceBasedShippingMethodArgs: DistanceBasedShippingCalculatorOptions =
      {
        storeLatitude: storeGeoLocation.latitude,
        storeLongitude: storeGeoLocation.longitude,
        pricePerKm: 10,
        fallbackPrice: 20,
        taxRate: 0,
      };
    const shippingDistance = getDistanceBetweenPointsInKMs(
      storeGeoLocation,
      shippingAddressGeoLocation,
    );
    const expectedPrice = roundMoney(
      priceBasedShippingMethodArgs.pricePerKm * shippingDistance,
    );
    const distanceBasedShippingMethod = await createDistanceBasedShippingMethod(
      adminClient,
      priceBasedShippingMethodArgs,
    );
    expect(distanceBasedShippingMethod.id).toBeDefined();
    const order: any = await createSettledOrder(
      shopClient,
      distanceBasedShippingMethod.id,
      true,
      [
        { id: 'T_1', quantity: 1 },
        { id: 'T_2', quantity: 2 },
      ],
      undefined,
      { input: shippingAdress },
    );
    expect(order.shipping).toBe(expectedPrice);
  });
});

describe('Country based Promotion condition', function () {
  it('Creates promotion hat gives free shipping for orders in NL', async () => {
    const promotion = await createPromotion(adminClient, {
      input: {
        conditions: [
          {
            code: 'order_in_country',
            arguments: [
              {
                name: 'countries',
                value: '["NL"]',
              },
            ],
          },
        ],
        actions: [
          {
            code: 'free_shipping',
            arguments: [],
          },
        ],
        enabled: true,
        translations: [
          {
            languageCode: LanguageCode.En,
            name: 'Free Shipping for NL',
            customFields: {},
          },
        ],
        customFields: {},
      },
    });
    expect(promotion.name).toBe('Free Shipping for NL');
  });

  it('Order in NL should have free shipping', async () => {
    // Default country is NL
    const order = await createSettledOrder(shopClient, 1, true, [
      {
        id: 'T_3', // Variant 3's weight hasn't been altered yet
        quantity: 1,
      },
    ]);
    expect(order.state).toBe('PaymentSettled');
    expect(order.shippingWithTax).toBe(0);
  });

  it('Order in BE should NOT have free shipping', async () => {
    const order = await createSettledOrder(
      shopClient,
      1,
      true,
      [
        {
          id: 'T_3', // Variant 3's weight hasn't been altered yet
          quantity: 1,
        },
      ],
      undefined,
      {
        input: {
          countryCode: 'BE',
          streetLine1: 'Brussels Street',
        },
      },
    );
    expect(order.state).toBe('PaymentSettled');
    expect(order.shippingWithTax).toBe(111);
  });
});

afterAll(async () => {
  await server.destroy();
}, 100000);
