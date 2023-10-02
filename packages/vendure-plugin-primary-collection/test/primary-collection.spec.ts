import {
  ChannelService,
  DefaultLogger,
  LogLevel,
  RequestContext,
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
import { initialTestData } from './initial-test-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { PrimaryCollectionPlugin } from '../src/primary-collection-plugin';
import { expect, describe, beforeAll, afterAll, it } from 'vitest';
import { gql } from 'graphql-tag';
import { PrimaryCollectionHelperService } from '../src/api/primary-collections-helper.service';

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

  it("Shouldn't have primaryCollections set on products with id 'T_2' and 'T_3'", async () => {
    const { product } = await shopClient.query(primaryCollectionQuery, {
      productId: 'T_2',
    });
    const { product: anotherProduct } = await shopClient.query(
      primaryCollectionQuery,
      {
        productId: 'T_3',
      }
    );
    expect(product.primaryCollection).toBeNull();
    expect(anotherProduct.primaryCollection).toBeNull();
  });

  it(`Should assign primaryCollection to all products after running the "setPrimaryCollectionForAllProducts" function, 
  while preserving the values for those products who already had `, async () => {
    const defualtChannel = await server.app
      .get(ChannelService)
      .getDefaultChannel();
    const ctx = new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel: defualtChannel,
    });
    await server.app
      .get(PrimaryCollectionHelperService)
      .setPrimaryCollectionForAllProducts(ctx);
    const { product: t1Product } = await shopClient.query(
      primaryCollectionQuery,
      {
        productId: 'T_1',
      }
    );
    const { product: t2Product } = await shopClient.query(
      primaryCollectionQuery,
      {
        productId: 'T_2',
      }
    );
    const { product: t3Product } = await shopClient.query(
      primaryCollectionQuery,
      {
        productId: 'T_3',
      }
    );
    expect(t1Product.primaryCollection.name).toBe('Electronics');
    expect(t2Product.primaryCollection).not.toBeNull();
    expect(t3Product.primaryCollection).not.toBeNull();
  });

  afterAll(async () => {
    return server.destroy();
  });
});
