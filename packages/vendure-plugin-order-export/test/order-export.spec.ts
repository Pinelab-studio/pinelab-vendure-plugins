import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { OrderExportPlugin } from '../src';

describe('Order export plugin', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3105,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        OrderExportPlugin.init({
          exportStrategies: [],
        }),
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
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
    await createSettledOrder(shopClient, 1);
    await createSettledOrder(shopClient, 1);
    await createSettledOrder(shopClient, 1);
    serverStarted = true;
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Should fetch available strategies', async () => {
    await adminClient.asSuperAdmin();
    const result = await adminClient.query(
      gql`
        query availableOrderExportStrategies {
          availableOrderExportStrategies
        }
      `,
    );
    await expect(result.availableOrderExportStrategies.length).toBe(1);
  });

  it('Should fetch export file', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await adminClient.asSuperAdmin();
    const res = await adminClient.fetch(
      `http://localhost:3105/export-orders/export/example-export?startDate=${yesterday.toISOString()}&endDate=${tomorrow.toISOString()}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-type')).toContain('text/csv');
    // With native fetch (vendure 3.7.0) the body is a ReadableStream
    expect(res.body).not.toBeNull();
  });

  afterAll(() => {
    return server.destroy();
  }, 50000);
});
