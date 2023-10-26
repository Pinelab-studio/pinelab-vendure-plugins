import {
  AccountRegistrationEvent,
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
  AvailableWebhookEventsQuery,
  AvailableWebhookRequestTransformersQuery,
  SetWebhooksMutation,
  SetWebhooksMutationVariables,
  WebhooksQuery,
} from '../src/generated/graphql-types';
import {
  getAvailableWebhookEventsQuery,
  getAvailableWebhookRequestTransformersQuery,
  getWebhooksQuery,
  setWebhooksMutation,
} from '../src/ui/queries';
import { stringifyProductTransformer } from './test-helpers';
import { describe, beforeAll, it, expect, afterEach, afterAll } from 'vitest';
import getFilesInAdminUiFolder from '../../util/src/compile-admin-ui.util';

describe('Webhook plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let serverStarted = false;
  let ctx: RequestContext;
  const testProductWebhookUrl = 'https://rebuild-static-site.io';
  const testRegistrationUrl = 'https://my-security-logger.io';

  function publishMockProductEvent() {
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'created'));
  }

  function publishMockRegistrationEvent() {
    server.app
      .get(EventBus)
      .publish(new AccountRegistrationEvent(ctx, {} as any));
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
          events: [ProductEvent, AccountRegistrationEvent],
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

  it('Should set webhooks for channel', async () => {
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
        // AccountRegistrationEvent webhook with default transformer
        {
          event: 'AccountRegistrationEvent',
          url: testRegistrationUrl,
        },
      ],
    });
    await expect(setWebhooks[0].event).toBe('ProductEvent');
    await expect(setWebhooks[0].url).toBe(testProductWebhookUrl);
    await expect(setWebhooks[0].requestTransformer?.supportedEvents[0]).toBe(
      'ProductEvent'
    );
    await expect(setWebhooks[0].requestTransformer?.name).toBeDefined();
    await expect(setWebhooks[1].event).toBe('AccountRegistrationEvent');
    await expect(setWebhooks[1].url).toBe(testRegistrationUrl);
    await expect(setWebhooks[1].requestTransformer).toBe(null);
  });

  it('Should get all webhooks for current channel', async () => {
    const { webhooks } = await adminClient.query<WebhooksQuery>(
      getWebhooksQuery
    );
    await expect(webhooks.length).toBe(2);
    await expect(webhooks[0].event).toBe('ProductEvent');
    await expect(webhooks[0].url).toBe(testProductWebhookUrl);
    await expect(webhooks[0].requestTransformer?.supportedEvents[0]).toBe(
      'ProductEvent'
    );
    await expect(webhooks[0].requestTransformer?.name).toBeDefined();
  });

  it('Should get available events', async () => {
    const { availableWebhookEvents } =
      await adminClient.query<AvailableWebhookEventsQuery>(
        getAvailableWebhookEventsQuery
      );
    const hasRegistrationEvent = availableWebhookEvents.some(
      (event) => event === 'AccountRegistrationEvent'
    );
    const hasProductEvent = availableWebhookEvents.some(
      (event) => event === 'ProductEvent'
    );
    await expect(availableWebhookEvents.length).toBe(2);
    await expect(hasRegistrationEvent).toBe(true);
    await expect(hasProductEvent).toBe(true);
  });

  it('Should get available request tranformers', async () => {
    const { availableWebhookRequestTransformers } =
      await adminClient.query<AvailableWebhookRequestTransformersQuery>(
        getAvailableWebhookRequestTransformersQuery
      );
    expect(availableWebhookRequestTransformers.length).toBe(1);
    expect(availableWebhookRequestTransformers[0].name).toBe(
      'Stringify Product events'
    );
    expect(availableWebhookRequestTransformers[0].supportedEvents[0]).toBe(
      'ProductEvent'
    );
  });

  it('Should call webhook on ProductEvent with custom body and headers', async () => {
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
    await new Promise((resolve) => setTimeout(resolve, 500)); // Await async eventBus processing
    expect(receivedPayloads.length).toBe(1);
    expect(receivedPayloads[0].type).toBe('created');
    expect(receivedPayloads[0].ctx).toBeDefined();
    // See test-helpers.ts to see where these values are coming from
    expect(receivedHeaders['x-custom-header']).toEqual([
      'stringify-custom-header',
    ]);
  });

  it('Should call webhook on AccountRegistrationEvent with empty body', async () => {
    const receivedPayloads: any[] = [];
    nock(testRegistrationUrl)
      .post(/.*/, (body) => {
        receivedPayloads.push(body);
        return true;
      })
      .reply(200);
    publishMockRegistrationEvent();
    await new Promise((resolve) => setTimeout(resolve, 500)); // Await async eventBus processing
    expect(receivedPayloads.length).toBe(1);
  });

  it('Should call webhook once with multiple events within 200ms', async () => {
    let received: any[] = [];
    nock(testProductWebhookUrl)
      .post(/.*/, (body) => !!received.push(body))
      .reply(200, {})
      .persist();
    // Publish 3 events shortly after each other
    publishMockProductEvent();
    publishMockProductEvent();
    publishMockProductEvent();
    await new Promise((resolve) => setTimeout(resolve, 500)); // Await async eventBus processing
    // Plugin should have batched all events fired within 200ms
    expect(received.length).toBe(1);
  });

  it('Should call webhook twice when events are apart more than 200ms', async () => {
    let received: any[] = [];
    nock(testProductWebhookUrl)
      .persist()
      .post(/.*/, (body) => !!received.push(body))
      .reply(200, {})
      .persist();
    publishMockProductEvent();
    await new Promise((resolve) => setTimeout(resolve, 300));
    publishMockProductEvent();
    await new Promise((resolve) => setTimeout(resolve, 500)); // Await async eventBus processing
    expect(received.length).toBe(2);
  });

  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(__dirname, WebhookPlugin.ui);
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);
});
