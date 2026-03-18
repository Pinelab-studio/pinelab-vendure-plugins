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
  await adminClient.query(CREATE_CONTENT_ENTRY, {
    input: {
      code: 'homepage',
      name: 'Homepage',
      contentTypeCode: 'featured_product',
      fields: {
        title: 'Welcome to Simple CMS',
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log('Vendure dev server started with initial content entry');
})();
