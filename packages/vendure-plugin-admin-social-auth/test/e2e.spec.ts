import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import path from 'path';
import { initialData } from '../../test/src/initial-data';
import { AdminSocialAuthPlugin } from '../src';
import { describe, it, beforeAll, expect, afterAll } from 'vitest';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
const serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      AdminSocialAuthPlugin.init({
        google: {
          oAuthClientId: 'Just a test',
        },
      }),
    ],
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
}, 60000);

it('Should start successfully', async () => {
  await expect(server.app.getHttpServer).toBeDefined;
});

afterAll(() => {
  return server.destroy();
});
