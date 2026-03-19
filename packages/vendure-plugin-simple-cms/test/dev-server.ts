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
      code
      name
      contentTypeCode
      fields
      translatableFields {
        id
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
  await adminClient
    .query(CREATE_CONTENT_ENTRY, {
      input: {
        code: 'homepage',
        name: 'Homepage',
        contentTypeCode: 'featuredProduct',
        fields: {
          // Primitive non-translatable field
          subtitle: 'The best products',
          // Relation field (Asset ID)
          image: 1,
        },
        translations: [
          {
            languageCode: 'en',
            fields: {
              // Translatable primitive field
              title: 'Welcome to Simple CMS',
              // Translatable struct field
              seo: {
                metaTitle: 'Home | My Shop',
                metaDescription: 'Browse our featured products',
              },
            },
          },
          {
            languageCode: 'nl',
            fields: {
              title: 'Welkom bij Simple CMS',
              seo: {
                metaTitle: 'Home | Mijn Winkel',
                metaDescription: 'Bekijk onze uitgelichte producten',
              },
            },
          },
        ],
      },
    })
    .catch((error) => {
      console.error(error);
    });

  // eslint-disable-next-line no-console
  console.log('Vendure dev server started with initial content entry');
})();
