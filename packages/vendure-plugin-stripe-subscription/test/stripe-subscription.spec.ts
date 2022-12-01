import {
  ClientError,
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { EmailPlugin } from '@vendure/email-plugin';
import { TestServer } from '@vendure/testing/lib/test-server';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import gql from 'graphql-tag';
import { StockMonitoringPlugin } from '../src/stock-monitoring.plugin';
import { createLowStockEmailHandler } from '../src/api/low-stock.email-handler';
import * as path from 'path';
import { createSettledOrder } from '../../test/src/shop-utils';
import * as fs from 'fs';
import { stripeSubscriptionHandler } from '../src/stripe-subscription.handler';

jest.setTimeout(20000);

describe('Order export plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  const testEmailDir = path.join(__dirname, './test-emails');
  const emailHandlerConfig = {
    subject: 'Low stock',
    threshold: 100,
  };

  beforeAll(async () => {
    try {
      const files = fs.readdirSync(testEmailDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testEmailDir, file)); // Delete previous test emails
      }
    } catch (err) {}

    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [StockMonitoringPlugin.init({ threshold: 101 })],
      paymentOptions: {
        paymentMethodHandlers: [stripeSubscriptionHandler],
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
    serverStarted = true;
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  // TODO
  // Create paymentmethod
  // Prepare order
  // Create paymentlink with one time payment
  // Create paymentlink with monthly payments, downpayment and prorated amount
});
