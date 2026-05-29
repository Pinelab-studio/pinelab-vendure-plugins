import {
  DefaultLogger,
  EventBus,
  Injector,
  LogLevel,
  mergeConfig,
  ProductEvent,
  Logger,
  ProductVariantEvent,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import nock from 'nock';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { waitFor } from '../../test/src/test-helpers';
import {
  AlertingPlugin,
  EventAlert,
  LogAlert,
  WebhookNotifier,
  Notifier,
  AlertMessage,
  AlertingService,
} from '../src';

class TestNotifier implements Notifier {
  readonly name: string;
  messages: AlertMessage[] = [];
  constructor(name: string) {
    this.name = name;
  }
  async notify(message: AlertMessage): Promise<void> {
    this.messages.push(message);
  }
}

describe('Alerting plugin', function () {
  let server: TestServer;
  let serverStarted = false;
  let notifier1: TestNotifier;
  let notifier2: TestNotifier;
  let notifier3: TestNotifier;
  let ctx: any;

  beforeAll(async () => {
    notifier1 = new TestNotifier('notifier1');
    notifier2 = new TestNotifier('notifier2');
    notifier3 = new TestNotifier('notifier3');

    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: { port: 3105 },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        AlertingPlugin.init({
          alerts: [
            // Alert 1: simple event alert with string notify
            new EventAlert([notifier1])
              .on(ProductEvent)
              .notify((_ctx, _injector, e) => `Product event: ${e.type}`),

            // Alert 2: filtered event alert with object notify, multiple notifiers, multiple events
            new EventAlert([notifier1, notifier2])
              .on(ProductEvent, ProductVariantEvent)
              .filter((e) => e.type === 'created')
              .notify(() => ({
                subject: 'Filtered',
                text: 'Product created',
              })),

            // Alert 3: log-based alert
            new LogAlert([notifier1])
              .onLog('error', 'warn')
              .filter((log) => log.loggerCtx === 'TestCtx')
              .notify((log) => ({
                subject: `[${log.level}] Alert`,
                text: log.message,
              })),

            // Alert 4: async event alert with ctx and injector
            new EventAlert([notifier3])
              .on(ProductEvent)
              .notify(async (eventCtx, injector, event) => {
                expect(eventCtx).toBeDefined();
                expect(injector).toBeInstanceOf(Injector);
                return `Async product event: ${event.type}`;
              }),
          ],
          deduplicationWindowMs: 500,
        }),
      ],
    });

    ({ server } = createTestEnvironment(config));
    await server.init({
      initialData: initialData as any,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
    ctx = await getSuperadminContext(server.app);
  }, 60000);

  beforeEach(async () => {
    notifier1.messages = [];
    notifier2.messages = [];
    notifier3.messages = [];
    const service = server.app.get(AlertingService) as any;
    if (service.dedupMap) {
      service.dedupMap.clear();
    }
    // Wait for any in-flight JobQueue messages from the previous test to settle.
    // Without this, a late alert job can bleed into the next test and cause flakiness.
    await new Promise((r) => setTimeout(r, 300));
  });

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  it('Should send alert on ProductEvent', async () => {
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'updated'));
    await waitFor(() => notifier1.messages.length >= 1);
    expect(notifier1.messages.length).toBe(1);
    expect(notifier1.messages[0].text).toBe('Product event: updated');
  });

  it('Should filter events and only alert on created', async () => {
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'updated'));
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'created'));
    await waitFor(() => notifier2.messages.length >= 1);
    // notifier2 only receives the filtered 'created' alert
    expect(notifier2.messages.length).toBe(1);
    expect(notifier2.messages[0].subject).toBe('Filtered');
    expect(notifier2.messages[0].text).toBe('Product created');
    // notifier1 receives both the unfiltered 'updated' and the filtered 'created' alert
    expect(notifier1.messages.length).toBeGreaterThanOrEqual(2);
    expect(
      notifier1.messages.some((m) => m.text === 'Product event: updated')
    ).toBe(true);
    expect(notifier1.messages.some((m) => m.text === 'Product created')).toBe(
      true
    );
  });

  it('Should deduplicate identical alerts within the window', async () => {
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'updated'));
    await waitFor(() => notifier1.messages.length >= 1);
    // Fire a second identical event shortly after
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'updated'));
    await new Promise((r) => setTimeout(r, 200));
    // Only 1 should have been sent because dedup window is 500ms
    expect(notifier1.messages.length).toBe(1);
  });

  it('Should send log-based alerts', async () => {
    Logger.error('Test error message', 'TestCtx');
    await waitFor(() =>
      notifier1.messages.some((m) => m.text === 'Test error message')
    );
    const msg = notifier1.messages.find(
      (m) => m.text === 'Test error message'
    )!;
    expect(msg.subject).toBe('[error] Alert');
    expect(msg.text).toBe('Test error message');
  });

  it('Should pass ctx and injector to async event notify', async () => {
    server.app
      .get(EventBus)
      .publish(new ProductEvent(ctx, undefined as any, 'updated'));
    await waitFor(() => notifier3.messages.length >= 1);
    expect(notifier3.messages.length).toBe(1);
    expect(notifier3.messages[0].text).toBe('Async product event: updated');
  });

  it('Should not alert on its own logger context', async () => {
    Logger.error('Self loop message', 'AlertingPlugin');
    await new Promise((r) => setTimeout(r, 300));
    // Should NOT have received any message for this context
    const matching = notifier1.messages.filter(
      (m) => m.text === 'Self loop message'
    );
    expect(matching.length).toBe(0);
  });

  it('Should allow multiple events on the same alert', () => {
    const n = new TestNotifier('multi');
    const alert = new EventAlert([n]).on(ProductEvent).on(ProductEvent);
    expect(alert.events.length).toBe(2);
  });

  it('Should call webhook notifier', async () => {
    const receivedPayloads: any[] = [];
    const webhookUrl = 'https://test-webhook.example.com';
    nock(webhookUrl)
      .post(/.*/, (body) => {
        receivedPayloads.push(body);
        return true;
      })
      .reply(200);

    const webhookNotifier = new WebhookNotifier({
      name: 'webhook-test',
      url: webhookUrl,
      headers: { 'X-Custom': 'test' },
    });

    await webhookNotifier.notify({
      subject: 'Test',
      text: 'Hello',
      metadata: { headers: { 'X-Event': 'test' } },
    });

    expect(receivedPayloads.length).toBe(1);
    expect(receivedPayloads[0].subject).toBe('Test');
    expect(receivedPayloads[0].text).toBe('Hello');
  });

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});
