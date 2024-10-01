import { defaultShippingEligibilityChecker, Promotion } from '@vendure/core';
import { SimpleGraphQLClient } from '@vendure/testing';
import { distanceBasedShippingCalculator } from '../src/config/distance-based-shipping-calculator';
import { gql } from 'graphql-tag';
import { ConfigArgInput } from '../../test/src/generated/shop-graphql';
import {
  CreatePromotion,
  CreatePromotionMutation,
  CreatePromotionMutationVariables,
  LanguageCode,
} from '../../test/src/generated/admin-graphql';

/**
 * This helper keeps polling a condition function until it returns a value or times out.
 * Use this instead of arbitrary `await new Promise()` calls.
 *
 * @example
 * // This invoice will be defined, or an error is thrown after timeout
 * const invoice = await waitFor(() => getInvoice(order.id));
 */
export async function waitFor<T>(
  conditionFn: () => Promise<T | undefined> | T | undefined,
  interval = 100,
  timeout = 10000
) {
  const startTime = Date.now();
  let result: T | undefined;
  let elapsedTime = 0;
  while (elapsedTime < timeout) {
    result = await conditionFn();
    if (result) {
      return result;
    }
    elapsedTime = Date.now() - startTime;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`'waitFor()' Failed to resolve a value after ${timeout}ms`);
}

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

export async function createShippingMethod(
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
        code: 'zone-aware-flat-rate-shipping-calculator',
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
            name: 'taxCategoryId',
            value: '3',
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

export interface DistanceBasedShippingCalculatorOptions {
  storeLatitude: number;
  storeLongitude: number;
  pricePerKm: number;
  fallbackPrice: number;
  taxRate: number;
}

export async function createDistanceBasedShippingMethod(
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

export async function createPromotion(
  adminClient: SimpleGraphQLClient,
  input: CreatePromotionMutationVariables
): Promise<Promotion> {
  const { createPromotion } = await adminClient.query<
    CreatePromotionMutation,
    CreatePromotionMutationVariables
  >(CreatePromotion, input);
  return createPromotion as Promotion;
}
