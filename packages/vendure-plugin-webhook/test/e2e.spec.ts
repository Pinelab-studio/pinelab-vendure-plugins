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
import { WebhookPlugin, WebhookRequestFn } from '../src';
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
  let ctx: RequestContext;

  function publishMockEvent() {
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'created'));
  }

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
          delay: 200,
          events: [ProductEvent],
        }),
      ],
    });

    ({ server } = createTestEnvironment(config));
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
    ctx = new RequestContext({
      apiType: 'admin',
      channel: await server.app.get(ChannelService).getDefaultChannel(),
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
    });
    await server.app.get(WebhookService).saveWebhook('https://testing', '1');
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Should post custom body', async () => {
    let received: any[] = [];
    nock('https://testing')
      .post(/.*/, (body) => !!received.push(body))
      .reply(200, {});
    publishMockEvent();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(received.length).toBe(1);
    expect(received[0].createdAt).toBeDefined();
  });

  it('Should send custom headers', async () => {
    let headers: Record<string, string>;
    nock('https://testing')
      .post(/.*/)
      .reply(200, function () {
        headers = this.req.headers;
      });
    publishMockEvent();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(headers!['test']).toStrictEqual(['1234']);
  });

  it('Should not send duplicate events', async () => {
    let received: any[] = [];
    nock('https://testing')
      .post(/.*/, (body) => !!received.push(body))
      .reply(200, {});
    publishMockEvent();
    publishMockEvent();
    publishMockEvent();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(received.length).toBe(1);
    expect(received[0].createdAt).toBeDefined();
  });

  it('Should send duplicate events after delay', async () => {
    let received: any[] = [];
    nock('https://testing')
      .persist()
      .post(/.*/, (body) => !!received.push(body))
      .reply(200, {});
    publishMockEvent();
    await new Promise((resolve) => setTimeout(resolve, 300));
    publishMockEvent();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(received.length).toBe(2);
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
