import {
  DefaultLogger, InitialData,
  LogLevel,
  mergeConfig
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import nock from 'nock';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import { FacetSuggestionsPlugin } from '../src/facet-suggestions.plugin';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      FacetSuggestionsPlugin
    ],
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
  await expect(true).toBe(false);
});

if (process.env.TEST_ADMIN_UI) {
  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(__dirname, WebhookPlugin.ui);
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);
}

afterAll(async () => {
  await server.destroy();
}, 100000);
