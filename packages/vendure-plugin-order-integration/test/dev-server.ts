import {
  DefaultLogger,
  DefaultSearchPlugin,
  Logger,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  HookName,
  OrderIntegrationEvent,
  OrderIntegrationPlugin,
  OrderIntegrationStrategy,
} from '../src';

const demoHooks: HookName[] = [
  'onOrderPlaced',
  'onOrderUpdated',
  'onOrderStateTransition',
  'onOrderLineCreated',
  'onOrderLineUpdated',
  'onOrderLineDeleted',
  'onOrderLineCancelled',
  'onPaymentStateTransition',
  'onRefundCreated',
  'onRefundStateTransition',
  'onFulfillmentCreated',
  'onFulfillmentStateTransition',
  'onStockShortfall',
];

/**
 * Demo strategy for the dev server: logs every hook under the 'DemoIntegration' logger
 * context, fails the first attempt of each onOrderPlaced event to show a retry, and
 * echoes webhooks sent to /order-integration/demo/<connectionId>.
 */
function createDemoStrategy(): OrderIntegrationStrategy {
  const failedOnce = new Set<string>();
  const strategy: Record<string, unknown> = {
    name: 'demo',
    onWebhookReceived: async (request: { route: unknown; body: unknown }) => {
      Logger.info(
        `webhook ${JSON.stringify(request.route)} body ${JSON.stringify(request.body)}`,
        'DemoIntegration',
      );
      return { statusCode: 200, body: { received: request.body ?? null } };
    },
  };
  for (const hook of demoHooks) {
    strategy[hook] = (_ctx: unknown, event: OrderIntegrationEvent<object>) => {
      if (hook === 'onOrderPlaced' && !failedOnce.has(event.eventId)) {
        failedOnce.add(event.eventId);
        throw new Error('Demo: first attempt fails, the job queue retries it');
      }
      Logger.info(
        `${hook} orders ${JSON.stringify(event.orderIds)} data ${JSON.stringify(event.data)}${event.input ? ` input ${JSON.stringify(event.input)}` : ''}`,
        'DemoIntegration',
      );
    };
  }
  return strategy as unknown as OrderIntegrationStrategy;
}

/**
 * The dev-server is just for development. Feel free to break anything here.
 */
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  // eslint-disable-next-line
  require('dotenv').config();

  // eslint-disable-next-line
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config: Required<VendureConfig> = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    dbConnectionOptions: {
      // autoSave: true, // Uncomment this line to persist the database between restarts
    },
    authOptions: {
      tokenMethod: ['cookie', 'bearer'],
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      OrderIntegrationPlugin.init({ strategies: [createDemoStrategy()] }),
      DefaultSearchPlugin,
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
  await server.init({
    initialData: {
      ...initialData,
      paymentMethods: [
        {
          name: testPaymentMethod.code,
          handler: { code: testPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
