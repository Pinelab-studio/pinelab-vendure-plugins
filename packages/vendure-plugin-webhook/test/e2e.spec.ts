import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  ChannelService,
  CollectionModificationEvent,
  DefaultLogger,
  EventBus,
  InitialData,
  LogLevel,
  mergeConfig,
  ProductEvent,
  ProductVariantChannelEvent,
  ProductVariantEvent,
  RequestContext,
} from '@vendure/core';
import { WebhookPlugin } from '../src';
import { TestServer } from '@vendure/testing/lib/test-server';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';
import * as fs from 'fs';
import nock from 'nock';
import { WebhookService } from '../src/api/webhook.service';

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
          requestFn: (event) => {
            // Do stuff with your event here
            return {
              headers: { test: '1234' },
              body: JSON.stringify({ createdAt: event.createdAt }),
            };
          },
          delay: 0,
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
    await server.app.get(WebhookService).saveWebhook('https://testing', '1');
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Should post custom body', async () => {
    let savedBody: any;
    nock('https://testing')
      .persist()
      .post(/.*/, (body) => {
        savedBody = body;
        return true;
      })
      .reply(200, {});
    const ctx = new RequestContext({
      apiType: 'admin',
      channel: await server.app.get(ChannelService).getDefaultChannel(),
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
    });
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'created'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(savedBody.createdAt).toBeDefined();
  });

  it.skip('Should compile admin', async () => {
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
