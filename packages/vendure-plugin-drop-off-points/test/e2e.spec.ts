import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { gql } from 'graphql-tag';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import {
  DropOffPointsPlugin,
  Mutation,
  MutationSetParcelDropOffPointArgs,
  QueryParcelDropOffPointsArgs,
} from '../src';
import { MockCarrier } from './mock-carrier';
import { addItem } from '../../test/src/shop-utils';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: console,
    plugins: [
      DropOffPointsPlugin.init({
        carriers: [new MockCarrier()],
      }),
    ],
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  await adminClient.asSuperAdmin();
}, 30000);

afterAll(async () => {
  await server.destroy();
}, 100000);

it('Started the server', () => {
  expect(server.app.getHttpServer()).toBeDefined();
});

let dropOffPointToken: string;

it('Fetches drop off points', async () => {
  const { parcelDropOffPoints } = await shopClient.query<
    any,
    QueryParcelDropOffPointsArgs
  >(getDropOffPointsQuery, {
    input: {
      carrier: 'mock',
      postalCode: '1234AB',
      houseNumber: '1',
    },
  });
  dropOffPointToken = parcelDropOffPoints[0].token;
  expect(parcelDropOffPoints[0].token).toBeDefined();
  expect(parcelDropOffPoints[0].name).toBe('mock drop off point 𝓧');
  expect(parcelDropOffPoints[0].postalCode).toBe('1234AB');
  expect(parcelDropOffPoints[0].houseNumber).toBe('1');
});

it('Set drop off point on order', async () => {
  await addItem(shopClient, '1', 1); // Create an active order
  const { setDropOffPoint: order } = await shopClient.query<
    any,
    MutationSetParcelDropOffPointArgs
  >(setDropOffPointMutation, {
    token: dropOffPointToken,
  });
  expect(order.customFields.dropOffPointCarrier).toBe('mock');
  expect(order.customFields.dropOffPointName).toBe('mock drop off point 𝓧');
  expect(order.customFields.dropOffPointStreetLine1).toBe('mock street');
  expect(order.customFields.dropOffPointStreetLine2).toBe('mock street 2');
  expect(order.customFields.dropOffPointPostalCode).toBe('1234AB');
  expect(order.customFields.dropOffPointHouseNumber).toBe('1');
  expect(order.customFields.dropOffPointCity).toBe('mock city');
  expect(order.customFields.dropOffPointCountry).toBe('NL');
});

it('Unset drop off point', async () => {
  const { unsetDropOffPoint: order } = await shopClient.query(
    unsetDropOffPointMutation
  );
  expect(order.customFields.dropOffPointCarrier).toBeNull();
  expect(order.customFields.dropOffPointName).toBeNull();
  expect(order.customFields.dropOffPointStreetLine1).toBeNull();
  expect(order.customFields.dropOffPointStreetLine2).toBeNull();
  expect(order.customFields.dropOffPointPostalCode).toBeNull();
  expect(order.customFields.dropOffPointHouseNumber).toBeNull();
  expect(order.customFields.dropOffPointCity).toBeNull();
  expect(order.customFields.dropOffPointCountry).toBeNull();
});

const getDropOffPointsQuery = gql`
  query parcelDropOffPoints($input: ParcelDropOffPointSearchInput!) {
    parcelDropOffPoints(input: $input) {
      token
      dropOffPointId
      name
      streetLine1
      streetLine2
      postalCode
      houseNumber
      houseNumberSuffix
      city
      country
      latitude
      longitude
      distanceInKm
      cutOffTime
      additionalData
    }
  }
`;

const setDropOffPointMutation = gql`
  mutation setParcelDropOffPoint($token: String!) {
    setDropOffPoint(token: $token) {
      id
      code
      customFields {
        dropOffPointCarrier
        dropOffPointId
        dropOffPointName
        dropOffPointStreetLine1
        dropOffPointStreetLine2
        dropOffPointHouseNumber
        dropOffPointHouseNumberSuffix
        dropOffPointPostalCode
        dropOffPointCity
        dropOffPointCountry
      }
    }
  }
`;

const unsetDropOffPointMutation = gql`
  mutation unsetParcelDropOffPoint {
    unsetDropOffPoint {
      id
      code
      customFields {
        dropOffPointCarrier
        dropOffPointId
        dropOffPointName
        dropOffPointStreetLine1
        dropOffPointStreetLine2
        dropOffPointHouseNumber
        dropOffPointHouseNumberSuffix
        dropOffPointPostalCode
        dropOffPointCity
        dropOffPointCountry
      }
    }
  }
`;
