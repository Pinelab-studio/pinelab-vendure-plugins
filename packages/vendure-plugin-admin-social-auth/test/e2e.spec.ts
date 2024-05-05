import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { AdminSocialAuthPlugin } from '../src';

let server: TestServer;

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

  ({ server } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
}, 60000);

it('Should start successfully', () => {
  expect(server.app.getHttpServer()).toBeDefined();
});

afterAll(() => {
  return server.destroy();
});
