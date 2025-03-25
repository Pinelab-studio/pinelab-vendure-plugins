import { defaultShippingEligibilityChecker, Promotion } from '@vendure/core';
import { SimpleGraphQLClient } from '@vendure/testing';
import { gql } from 'graphql-tag';
import {
  CreatePromotion,
  CreatePromotionMutation,
  CreatePromotionMutationVariables,
} from '../../test/src/generated/admin-graphql';
import { distanceBasedShippingCalculator } from '../src/config/shipping/distance-based-shipping-calculator';

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

interface CountryAndWeightOptions {
  minWeight: number;
  maxWeight: number;
  countries: string[];
  exclude: boolean;
  rate: number;
}

export async function createShippingMethodForCountriesAndWeight(
  adminClient: SimpleGraphQLClient,
  options: CountryAndWeightOptions
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

interface CountryAndFacetOptions {
  facetIds: string | number[];
  countries: string[];
  exclude: boolean;
  rate: number;
}

export async function createShippingMethodForCountriesAndFacets(
  adminClient: SimpleGraphQLClient,
  options: CountryAndFacetOptions
) {
  const res = await adminClient.query(CREATE_SHIPPING_METHOD, {
    input: {
      code: 'shipping-by-facets-and-country',
      checker: {
        code: 'shipping-by-facets-and-country',
        arguments: [
          {
            name: 'facets',
            value: JSON.stringify(options.facetIds),
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
          name: 'Shipping by facet and country',
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
