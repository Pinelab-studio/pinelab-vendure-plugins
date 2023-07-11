import {
  CachedSession,
  DefaultLogger,
  ID,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { DataSource } from 'typeorm';
import { initialData } from '../../test/src/initial-data';
import { expect, describe, beforeAll, afterAll, it, vi, test } from 'vitest';
import { MultiServerDbSessionCachePlugin } from '../src/plugin';
import { gql } from 'graphql-tag';
import { MultiServerDbSessionCache } from '../src/session-cache';

describe('Multi-Server Db Session Cache Plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  let activeUserId: ID;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [MultiServerDbSessionCachePlugin],
    });
    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: '../test/src/products-import.csv',
      customerCount: 5,
    });
    serverStarted = true;
  }, 60000);

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  it('Should add item to order', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addItemToOrder } = await shopClient.query(
      gql`
        mutation AddItemToOrder($productVariantId: ID!, $quantity: Int!) {
          addItemToOrder(
            productVariantId: $productVariantId
            quantity: $quantity
          ) {
            ... on Order {
              id
              customer {
                emailAddress
                user {
                  id
                }
              }
            }
            ... on ErrorResult {
              message
            }
          }
        }
      `,
      {
        productVariantId: 'T_1',
        quantity: 1,
      }
    );
    expect(addItemToOrder.id).toBeDefined();
    expect(addItemToOrder.customer.emailAddress).toEqual(
      'hayden.zieme12@hotmail.com'
    );
    activeUserId = addItemToOrder.customer.user.id;
  });

  it('Should have cached session id', async () => {
    const dataSource = server.app.get(DataSource);
    const multiServerDbSessionCacheRepo = dataSource.getRepository(
      MultiServerDbSessionCache
    );
    const allSessions = await multiServerDbSessionCacheRepo.find();
    const sessionData = JSON.parse(allSessions[0].session) as CachedSession;
    expect(allSessions.length).toBeGreaterThan(1);
    expect(activeUserId).toEqual(`T_${sessionData.user?.id}`);
  });

  afterAll(async () => {
    await server.destroy();
  });
});
