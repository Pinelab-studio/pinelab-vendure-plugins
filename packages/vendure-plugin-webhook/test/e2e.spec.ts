import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  CollectionModificationEvent,
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
  ProductEvent,
  ProductVariantChannelEvent,
  ProductVariantEvent,
} from '@vendure/core';
import { WebhookPlugin } from '../src';
import { TestServer } from '@vendure/testing/lib/test-server';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';
import * as fs from 'fs';

jest.setTimeout(20000);

describe('Webhook plugin', function () {
  let server: TestServer;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3104,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        WebhookPlugin.init({
          httpMethod: 'POST',
          delay: 3000,
          events: [
            ProductEvent,
            ProductVariantChannelEvent,
            ProductVariantEvent,
            CollectionModificationEvent,
          ],
        }),
      ],
    });

    ({ server } = createTestEnvironment(config));
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Should compile admin', async () => {
    fs.rmSync(path.join(__dirname, '__admin-ui'), {
      recursive: true,
      force: true,
    });
    await compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [WebhookPlugin.ui],
    }).compile?.();
    const files = fs.readdirSync(path.join(__dirname, '__admin-ui/dist'));
    expect(files?.length).toBeGreaterThan(0);
  }, 240000);

  afterAll(() => {
    return server.destroy();
  });
});
