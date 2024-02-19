import {
  DefaultLogger,
  Facet,
  InitialData,
  LogLevel,
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
import nock from 'nock';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import { FacetSuggestionsPlugin } from '../src';
import { GET_REQUIRED_FACETS } from '../src/ui/suggested-facets-component/queries.graphql';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [FacetSuggestionsPlugin],
  });
  ({ server, adminClient } = createTestEnvironment(config));
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  serverStarted = true;
}, 60000);

// Clear nock mocks after each test
afterEach(() => nock.cleanAll());

it('Should start successfully', async () => {
  await expect(serverStarted).toBe(true);
});

it('Fetches required facets', async () => {
  await adminClient.asSuperAdmin();
  const { requiredFacets } = await adminClient.query(GET_REQUIRED_FACETS);
  await expect(requiredFacets).toEqual([]);
});

if (process.env.TEST_ADMIN_UI) {
  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(
      __dirname,
      FacetSuggestionsPlugin.ui,
    );
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);
}

afterAll(async () => {
  await server.destroy();
}, 100000);
