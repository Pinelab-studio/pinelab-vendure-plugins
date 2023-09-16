import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialTestData } from './initial-test-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { PrimaryCollectionPlugin } from '../src/primary-collection-plugin';
import { expect, describe, beforeAll, afterAll, it } from 'vitest';
import { gql } from 'graphql-tag';

describe('Product Primary Collection', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [PrimaryCollectionPlugin],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData: {
        ...initialTestData,
        paymentMethods: [
          {
            name: testPaymentMethod.code,
            handler: { code: testPaymentMethod.code, arguments: [] },
          },
        ],
      },
      productsCsvPath: './test/products.csv',
      customerCount: 2,
    });
    serverStarted = true;
  }, 60000);

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  const primaryCollectionQuery = gql`
    query PrimaryCollectionQuery($productId: ID) {
      product(id: $productId) {
        name
        primaryCollection {
          id
          name
        }
      }
    }
  `;

  it("Should return 'Computers' as a primary collection for 'Laptop'", async () => {
    const { product } = await shopClient.query(primaryCollectionQuery, {
      productId: 'T_1',
    });
    expect(product.name).toBe('Laptop');
    expect(product.primaryCollection.name).toBe('Computers');
  });

  it("Should return 'Computers' as a primary collection for 'Cars'", async () => {
    const { product } = await shopClient.query(primaryCollectionQuery, {
      productId: 'T_2',
    });
    expect(product.name).toBe('Cars');
    expect(product.primaryCollection.name).toBe('Computers');
  });

  it("Should return 'Electronics' as a primary collection for 'Motors'", async () => {
    const { product } = await shopClient.query(primaryCollectionQuery, {
      productId: 'T_3',
    });
    expect(product.name).toBe('Motors');
    expect(product.primaryCollection.name).toBe('Electronics');
  });

  afterAll(async () => {
    return server.destroy();
  });
});
