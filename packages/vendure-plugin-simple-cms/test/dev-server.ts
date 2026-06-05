import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import dotenv from 'dotenv';
import { config } from './vendure-config';
import { VendureConfig } from '@vendure/core';
import gql from 'graphql-tag';

const CREATE_CONTENT_ENTRY = gql`
  mutation CreateContentEntry($input: ContentEntryInput!) {
    createContentEntry(input: $input) {
      id
      contentTypeCode
      fields
      translations {
        languageCode
        fields
      }
    }
  }
`;
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  dotenv.config();
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
    initialData: {
      ...initialData,
    },
    productsCsvPath: '../test/src/products-import.csv',
  });

  await adminClient.asSuperAdmin();
  const seeds = [
    {
      label: 'FeaturedProduct',
      input: {
        contentTypeCode: 'featuredProduct',
        fields: { product: { id: 1 } },
        translations: [
          {
            languageCode: 'en',
            fields: {
              title: 'Featured title',
              seo: {
                metaTitle: 'Meta',
                metaDescription: 'Description',
              },
            },
          },
        ],
      },
    },
    {
      label: 'Banner 1',
      input: {
        contentTypeCode: 'banner',
        fields: { product: { id: 1 }, priority: 1 },
        translations: [
          { languageCode: 'en', fields: { title: 'Top banner EN' } },
        ],
      },
    },
    {
      label: 'Banner 2',
      input: {
        contentTypeCode: 'banner',
        fields: { product: { id: 1 }, priority: 2 },
        translations: [
          { languageCode: 'en', fields: { title: 'Side banner EN' } },
        ],
      },
    },
  ];
  for (const seed of seeds) {
    try {
      await adminClient.query(CREATE_CONTENT_ENTRY, { input: seed.input });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Error seeding ${seed.label}`, err);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    'Vendure dev server started with 1 FeaturedProduct and 2 Banners'
  );
})();
