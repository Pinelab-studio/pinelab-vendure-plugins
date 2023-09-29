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
    await adminClient.asSuperAdmin();
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

  const updatePrimaryCollectionMutation = gql`
    mutation UpdateProuductPrimaryCollection(
      $productId: ID!
      $productPrimaryCollectionId: ID
    ) {
      updateProduct(
        input: {
          id: $productId
          customFields: { primaryCollectionId: $productPrimaryCollectionId }
        }
      ) {
        name
        id
        customFields {
          primaryCollection {
            name
            id
          }
        }
      }
    }
  `;

  it("Should successfully update 'Laptop's primaryCollection as 'Electronics'", async () => {
    const { updateProduct: product } = await adminClient.query(
      updatePrimaryCollectionMutation,
      { productId: 'T_1', productPrimaryCollectionId: 'T_3' }
    );
    expect(product.name).toBe('Laptop');
    expect(product.id).toBe('T_1');
    expect(product.customFields.primaryCollection.name).toBe('Electronics');
  });

  it("Should return 'Electronics' as a primary collection for 'Laptop' in Shop API", async () => {
    const { product } = await shopClient.query(primaryCollectionQuery, {
      productId: 'T_1',
    });
    expect(product.name).toBe('Laptop');
    expect(product.primaryCollection.name).toBe('Electronics');
  });

  afterAll(async () => {
    return server.destroy();
  });
});
