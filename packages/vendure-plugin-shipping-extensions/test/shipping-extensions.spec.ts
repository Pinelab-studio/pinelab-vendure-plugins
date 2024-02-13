import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  ProductService,
  ProductVariantService,
  defaultShippingEligibilityChecker,
  RequestContext,
  roundMoney,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import { createSettledOrder } from '../../test/src/shop-utils';
import { ShippingExtensionsPlugin } from '../src/shipping-extensions.plugin';
import gql from 'graphql-tag';
import { expect, describe, beforeAll, afterAll, it, vi, test } from 'vitest';
import { distanceBasedShippingCalculator } from '../src/distance-based-shipping-calculator';
import {
  POSTCODES_URL,
  UKPostalCodeToGelocationConversionStrategy,
} from '../src/strategies/uk-postalcode-to-geolocation-strategy';
import { GeoLocation } from '../src/strategies/order-address-to-geolocation-strategy';
import nock from 'nock';
import { getDistanceBetweenPointsInKMs } from '../src/get-distance-between-points';
import { CreateAddressInput } from '../../test/src/generated/shop-graphql';

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
    await adminClient.asSuperAdmin();
    await expect(createSettledOrder(shopClient, 2)).rejects.toThrow(
      'ORDER_STATE_TRANSITION_ERROR'
    );
  });

  it('Is NOT eligible for method 1 and 2 with weight 200', async () => {
    const product = await server.app
      .get(ProductService)
      .update(ctx, { id: 1, customFields: { weight: 200 } });
    expect((product.customFields as any).weight).toBe(200);
    await expect(createSettledOrder(shopClient, 1)).rejects.toThrow(
      'ORDER_STATE_TRANSITION_ERROR'
    );
    await expect(createSettledOrder(shopClient, 2)).rejects.toThrow(
      'ORDER_STATE_TRANSITION_ERROR'
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
      'ORDER_STATE_TRANSITION_ERROR'
    );
    await expect(createSettledOrder(shopClient, 2)).rejects.toThrow(
      'ORDER_STATE_TRANSITION_ERROR'
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
      shippingAddressGeoLocation
    );
    const expectedPrice = roundMoney(
      priceBasedShippingMethodArgs.pricePerKm * shippingDistance
    );
    const distanceBasedShippingMethod = await createDistanceBasedShippingMethod(
      adminClient,
      priceBasedShippingMethodArgs
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
      { input: shippingAdress }
    );
    expect(order.shipping).toBe(expectedPrice);
  });
});

afterAll(async () => {
  await server.destroy();
}, 100000);

const CREATE_SHIPPING_METHOD = gql`
  mutation CreateShippingMethod($input: CreateShippingMethodInput!) {
    createShippingMethod(input: $input) {
      ... on ShippingMethod {
        id
        code
      }
      __typename
    }
  }
`;

interface Options {
  minWeight: number;
  maxWeight: number;
  countries: string[];
  exclude: boolean;
  rate: number;
}

async function createShippingMethod(
  adminClient: SimpleGraphQLClient,
  options: Options
) {
  const res = await adminClient.query(CREATE_SHIPPING_METHOD, {
    input: {
      code: 'shipping-by-weight-and-country',
      checker: {
        code: 'shipping-by-weight-and-country',
        arguments: [
          {
            name: 'minWeight',
            value: String(options.minWeight),
          },
          {
            name: 'maxWeight',
            value: String(options.maxWeight),
          },
          {
            name: 'countries',
            value: JSON.stringify(options.countries),
          },
          {
            name: 'excludeCountries',
            value: String(options.exclude),
          },
        ],
      },
      calculator: {
        code: 'default-shipping-calculator',
        arguments: [
          {
            name: 'rate',
            value: String(options.rate),
          },
          {
            name: 'includesTax',
            value: 'exclude',
          },
          {
            name: 'taxRate',
            value: '0',
          },
        ],
      },
      fulfillmentHandler: 'manual-fulfillment',
      customFields: {},
      translations: [
        {
          languageCode: 'en',
          name: 'Shipping by weight and country',
          description: '',
          customFields: {},
        },
      ],
    },
  });
  return res.createShippingMethod;
}

interface DistanceBasedShippingCalculatorOptions {
  storeLatitude: number;
  storeLongitude: number;
  pricePerKm: number;
  fallbackPrice: number;
  taxRate: number;
}
async function createDistanceBasedShippingMethod(
  adminClient: SimpleGraphQLClient,
  options: DistanceBasedShippingCalculatorOptions
) {
  const res = await adminClient.query(CREATE_SHIPPING_METHOD, {
    input: {
      code: 'shipping-by-distance',
      checker: {
        code: defaultShippingEligibilityChecker.code,
        arguments: [{ name: 'orderMinimum', value: '0' }],
      },
      calculator: {
        code: distanceBasedShippingCalculator.code,
        arguments: [
          {
            name: 'storeLatitude',
            value: String(options.storeLatitude),
          },
          {
            name: 'storeLongitude',
            value: String(options.storeLongitude),
          },
          {
            name: 'taxRate',
            value: String(options.taxRate),
          },
          {
            name: 'pricePerKm',
            value: String(options.pricePerKm),
          },
        ],
      },
      fulfillmentHandler: 'manual-fulfillment',
      customFields: {},
      translations: [
        {
          languageCode: 'en',
          name: 'Shipping by Distance',
          description: 'Distance Based Shipping Method',
          customFields: {},
        },
      ],
    },
  });
  return res.createShippingMethod;
}
