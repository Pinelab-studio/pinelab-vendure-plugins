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
import { DropOffPointsPlugin, QueryParcelDropOffPointsArgs } from '../src';
import { MockCarrier } from './mock-carrier';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      DropOffPointsPlugin.init({
        carriers: [new MockCarrier()],
      }),
    ],
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
  });
  await adminClient.asSuperAdmin();
}, 30000);

afterAll(async () => {
  await server.destroy();
}, 100000);

it('Started the server', () => {
  expect(server.app.getHttpServer()).toBeDefined();
});

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
  expect(parcelDropOffPoints[0].token).toBeDefined();
  expect(parcelDropOffPoints[0].postalCode).toBe('1234AB');
  expect(parcelDropOffPoints[0].houseNumber).toBe('1');
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
