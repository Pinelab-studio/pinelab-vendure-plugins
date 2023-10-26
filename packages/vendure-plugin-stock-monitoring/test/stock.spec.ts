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
import { expect, describe, beforeAll, it, afterAll } from 'vitest';
import getFilesInAdminUiFolder from '../../util/src/compile-admin-ui.util';
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
      plugins: [
        StockMonitoringPlugin.init({ threshold: 101 }),
        EmailPlugin.init({
          handlers: [
            createLowStockEmailHandler({
              ...emailHandlerConfig,
              emailRecipients: async () => ['test@test.com'], // Async function
            }),
            createLowStockEmailHandler({
              ...emailHandlerConfig,
              emailRecipients: () => ['test@test.com'], // Sync function
            }),
            createLowStockEmailHandler({
              ...emailHandlerConfig,
              emailRecipients: ['test@test.com'], // Array of strings
            }),
          ],
          route: 'mailbox',
          templatePath: path.join(__dirname, './templates/'),
          outputPath: testEmailDir,
          devMode: true,
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
    serverStarted = true;
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Fails for unauthenticated call', async () => {
    const queryPromise = adminClient.query(gql`
      query productVariantsWithLowStock {
        productVariantsWithLowStock {
          name
        }
      }
    `);
    await expect(queryPromise).rejects.toThrow(ClientError);
  });

  it('Gets variants with stocklevels below threshold', async () => {
    await adminClient.asSuperAdmin();
    const { productVariantsWithLowStock } = await adminClient.query(
      GET_OUT_OF_STOCK_VARIANTS
    );
    expect(productVariantsWithLowStock.length).toBe(4);
    expect(productVariantsWithLowStock[0].name).toBeDefined();
    expect(productVariantsWithLowStock[0].enabled).toBe(true);
    expect(productVariantsWithLowStock[0].stockOnHand).toBeLessThan(101);
    expect(productVariantsWithLowStock[0].productId).toBeDefined();
  });

  it('Does not return variants with stock above threshold', async () => {
    await adminClient.asSuperAdmin();
    await adminClient.query(gql`
      mutation updateProductVariants {
        updateProductVariants(input: [{ id: 1, stockOnHand: 105 }]) {
          id
        }
      }
    `);
    const { productVariantsWithLowStock } = await adminClient.query(
      GET_OUT_OF_STOCK_VARIANTS
    );
    expect(productVariantsWithLowStock.length).toBe(3);
  });

  it('Sends an email when stock is low after order placement', async () => {
    await createSettledOrder(shopClient, 1);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for event handling
    const files = fs.readdirSync(testEmailDir);
    expect(files.length).toBe(3); // 3 emails should be sent, one for every handler
  });
  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(
      __dirname,
      StockMonitoringPlugin.ui
    );
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});

export const GET_OUT_OF_STOCK_VARIANTS = gql`
  query productVariantsWithLowStock {
    productVariantsWithLowStock {
      name
      enabled
      stockOnHand
      productId
    }
  }
`;
