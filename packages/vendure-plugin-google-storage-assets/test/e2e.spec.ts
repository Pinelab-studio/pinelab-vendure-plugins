import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { DefaultLogger, LogLevel } from '@vendure/core';
import { GoogleStorageAssetsPlugin, GoogleStorageStrategy } from '../src';
import path from 'path';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { gql } from 'graphql-tag';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';

registerInitializer(
  'sqljs',
  new SqljsInitializer(path.join(__dirname, '__data__'))
);

describe('Google Storage Assets plugin', () => {
  const { server, adminClient, shopClient } = createTestEnvironment({
    ...testConfig,
    plugins: [
      GoogleStorageAssetsPlugin.init({
        bucketName: 'test-bucket',
        presets: {
          thumbnail: {
            extension: 'webp',
            generateFn: (sharp) => {
              return sharp.resize(100, 100).toFormat('webp').toBuffer();
            },
          },
        },
      }),
      AssetServerPlugin.init({
        storageStrategyFactory: () => new GoogleStorageStrategy(),
        route: 'assets',
        assetUploadDir: '/tmp/vendure/assets',
      }),
    ],
  });

  beforeAll(async () => {
    await server.init({
      initialData,
      productsCsvPath: path.join(
        __dirname,
        '../../test/src/products-import.csv'
      ),
      customerCount: 1,
    });
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('Should start server', async () => {
    expect(server.app.getHttpServer()).toBeDefined();
  });

  it('Should expose thumbnail preset in GraphQL schema', async () => {
    const getProduct = gql`
      {
        product(id: 1) {
          featuredAsset {
            id
            presets {
              thumbnail
            }
          }
        }
      }
    `;
    const { product } = await shopClient.query(getProduct);
    // Null means it didnt throw, meaning graphql validation passed
    expect(product.featuredAsset).toBeNull();
  });
});
