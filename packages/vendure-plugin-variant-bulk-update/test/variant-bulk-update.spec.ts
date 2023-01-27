import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from '../../test/src/initial-data';
import gql from 'graphql-tag';
import { VariantBulkUpdatePlugin } from '../src/variant-bulk-update.plugin';

describe('Limit variants per order plugin', function () {
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
      plugins: [VariantBulkUpdatePlugin],
    });
    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
    await adminClient.asSuperAdmin();
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Updates variant prices', async () => {
    await adminClient.asSuperAdmin();
    await adminClient.query(gql`
      mutation {
        updateProduct(input: { id: "T_1", customFields: { price: 2222 } }) {
          ... on Product {
            id
            variantList {
              items {
                id
                price
              }
            }
          }
        }
      }
    `);
    await new Promise((resolve) => setTimeout(resolve, 300)); // Let the worker do its work
    const { product } = await adminClient.query(gql`
      query {
        product(id: "T_1") {
          variants {
            price
          }
        }
      }
    `);
    expect(product.variants[0].price).toBe(2222);
    expect(product.variants[1].price).toBe(2222);
  });

  afterAll(() => {
    return server.destroy();
  });
});
