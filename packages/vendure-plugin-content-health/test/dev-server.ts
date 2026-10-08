import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { VendureConfig } from '@vendure/core';
import gql from 'graphql-tag';
import { initialData } from '../../test/src/initial-data';
import { config } from './vendure-config';
import { startMockStorefrontServer } from './mock-storefront-server';

/**
 * The dev-server is just for development. Feel free to break anything here.
 */
(async () => {
  await startMockStorefrontServer();

  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, adminClient } = createTestEnvironment(
    config as Required<VendureConfig>
  );
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });

  // Seed a deliberately-broken demo product so the findings block, overview
  // widget, and alert have something to show right after a scan: its mock
  // storefront page is missing JSON-LD, hreflang, and a meta description,
  // and has a too-short title.
  await adminClient.asSuperAdmin();
  await adminClient.query(
    gql`
      mutation CreateBrokenDemoProduct($input: CreateProductInput!) {
        createProduct(input: $input) {
          id
        }
      }
    `,
    {
      input: {
        translations: [
          {
            languageCode: 'en',
            name: 'Broken SEO Demo Product',
            slug: 'broken-seo-demo',
            description: '',
          },
        ],
      },
    }
  );
  console.log(
    'Seeded "Broken SEO Demo Product" (slug: broken-seo-demo). Run the ' +
      '"content-health-full-scan" scheduled task from the admin UI, ' +
      'then open this product to see the findings.'
  );
})();
