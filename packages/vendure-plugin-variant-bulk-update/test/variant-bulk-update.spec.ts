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
import { expect, describe, beforeAll, afterAll, it, vi, test } from 'vitest';
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
      plugins: [
        VariantBulkUpdatePlugin.init({
          enablePriceBulkUpdate: true,
          bulkUpdateCustomFields: ['unavailable'],
        }),
      ],
      customFields: {
        Product: [
          {
            name: 'unavailable',
            type: 'boolean',
          },
        ],
        ProductVariant: [
          {
            name: 'unavailable',
            type: 'boolean',
          },
        ],
      },
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
        updateProduct(
          input: { id: "T_1", customFields: { price: 2222, unavailable: true } }
        ) {
          ... on Product {
            id
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
            customFields {
              unavailable
            }
          }
        }
      }
    `);
    expect(product.variants[0].price).toBe(2222);
    expect(product.variants[1].price).toBe(2222);
    expect(product.variants[0].customFields.unavailable).toBe(true);
    expect(product.variants[1].customFields.unavailable).toBe(true);
  });

  it('Updates custom fields back to false', async () => {
    await adminClient.asSuperAdmin();
    await adminClient.query(gql`
      mutation {
        updateProduct(
          input: { id: "T_1", customFields: { unavailable: false } }
        ) {
          ... on Product {
            id
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
            customFields {
              unavailable
            }
          }
        }
      }
    `);
    expect(product.variants[0].customFields.unavailable).toBe(false);
    expect(product.variants[1].customFields.unavailable).toBe(false);
  });

  afterAll(() => {
    return server.destroy();
  });
});
