import {
  AttemptedLoginEvent,
  ChannelService,
  DefaultLogger,
  EventBus,
  InitialData,
  LogLevel,
  mergeConfig,
  ProductEvent,
  RequestContext,
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
import { initialData } from '../../test/src/initial-data';
import { WebhookPlugin } from '../src';
import {
  SetWebhooksMutation,
  SetWebhooksMutationVariables,
} from '../src/generated/graphql-types';
import { setWebhooksMutation } from '../src/ui/queries';
import { stringifyProductTransformer } from './test-helpers';

jest.setTimeout(20000);

describe('Webhook plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let serverStarted = false;
  let ctx: RequestContext;
  const testProductWebhookUrl = 'https://rebuild-static-site.io';
  const testAttemptedLoginUrl = 'https://my-security-logger.io';

  function publishMockProductEvent() {
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'created'));
  }

  function publishMockAttemptedLoginEvent() {
    server.app.get(EventBus).publish(new AttemptedLoginEvent(ctx, 'native'));
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
          delay: 200,
          events: [ProductEvent, AttemptedLoginEvent],
          requestTransformers: [stringifyProductTransformer],
        }),
      ],
    });
    ({ server, adminClient } = createTestEnvironment(config));
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
  }, 60000);

  // Clear nock mocks after each test
  afterEach(() => nock.cleanAll());

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it.only('Should set webhooks for channel', async () => {
    await adminClient.asSuperAdmin();
    const { setWebhooks } = await adminClient.query<
      SetWebhooksMutation,
      SetWebhooksMutationVariables
    >(setWebhooksMutation, {
      webhooks: [
        // ProductEvent webhook with custom transformer
        {
          event: 'ProductEvent',
          url: testProductWebhookUrl,
          transformerName: stringifyProductTransformer.name,
        },
        // AttemptedLoginEvent webhook with default transformer
        {
          event: 'AttemptedLoginEvent',
          url: testAttemptedLoginUrl,
        },
      ],
    });
    console.log('asdfasdfasfasdfafds=================', setWebhooks);
    await expect(setWebhooks[0]).toBe(true);
  });

  it('Should get all webhooks', async () => {
    await expect(false).toBe(true);
  });

  it('Should get available events', async () => {
    await expect(false).toBe(true);
  });

  it('Should get available request tranformers', async () => {
    await expect(false).toBe(true);
  });

  it('Should call webhook on ProductEvent', async () => {
    const receivedPayloads: any[] = [];
    let receivedHeaders: any;
    nock(testProductWebhookUrl)
      .post(/.*/, (body) => {
        receivedPayloads.push(body);
        return true;
      })
      .reply(200, function () {
        receivedHeaders = this.req.headers;
      });
    publishMockProductEvent();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Await async eventBus processing
    console.log(receivedPayloads);
    expect(receivedPayloads.length).toBe(1);
    expect(receivedPayloads[0].createdAt).toBeDefined();
    expect(receivedPayloads[0].channelId).toBeDefined();
    // See test-helpers.ts to see where these values are coming from
    expect(receivedHeaders['X-custom-header']).toBe('stringify-custom-header');
  });

  it('Should call a different webhook on AttemptedLoginEvent', async () => {
    const receivedPayloads: any[] = [];
    let receivedHeaders: any;
    nock(testAttemptedLoginUrl)
      .post(/.*/, (body) => {
        receivedPayloads.push(body);
        return true;
      })
      .reply(200, function () {
        receivedHeaders = this.req.headers;
      });
    publishMockAttemptedLoginEvent();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Await async eventBus processing
    console.log(receivedPayloads);
    expect(receivedPayloads.length).toBe(1);
    expect(receivedPayloads[0].createdAt).toBeDefined();
    expect(receivedPayloads[0].channelId).toBeDefined();
  });

  it('Should call webhook once with multiple events within the "delay" time', async () => {
    let received: any[] = [];
    nock('https://testing')
      .post(/.*/, (body) => !!received.push(body))
      .reply(200, {})
      .persist();
    // Publish 3 events within ~50ms
    publishMockProductEvent();
    publishMockProductEvent();
    publishMockProductEvent();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Await async eventBus processing
    // Plugin should have batched all events fired within 300ms
    expect(received.length).toBe(1);
  });

  it('Should call webhook twice when events occur over more than the set "delay" timeframe', async () => {
    let received: any[] = [];
    nock('https://testing')
      .persist()
      .post(/.*/, (body) => !!received.push(body))
      .reply(200, {})
      .persist();
    publishMockProductEvent();
    await new Promise((resolve) => setTimeout(resolve, 300));
    publishMockProductEvent();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Await async eventBus processing
    expect(received.length).toBe(2);
  });

  afterAll(() => {
    return server.destroy();
  });
});
