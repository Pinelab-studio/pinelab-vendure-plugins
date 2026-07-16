import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { VendureConfig } from '@vendure/core';
import gql from 'graphql-tag';
import { initialData } from '../../test/src/initial-data';
import { config } from './vendure-config';

(async () => {
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

  // Seed a facet that's always suggested on the product detail page,
  // so the "Suggested facets" block has something to show.
  await adminClient.asSuperAdmin();
  await adminClient.query(
    gql`
      mutation CreateFacet($input: CreateFacetInput!) {
        createFacet(input: $input) {
          id
        }
      }
    `,
    {
      input: {
        code: 'material',
        isPrivate: false,
        translations: [{ languageCode: 'en', name: 'Material' }],
        values: [
          { code: 'cotton', translations: [{ languageCode: 'en', name: 'Cotton' }] },
          { code: 'wool', translations: [{ languageCode: 'en', name: 'Wool' }] },
        ],
        customFields: { showOnProductDetail: true },
      },
    }
  );
  console.log('Seeded "Material" facet with showOnProductDetail: true');
})();
