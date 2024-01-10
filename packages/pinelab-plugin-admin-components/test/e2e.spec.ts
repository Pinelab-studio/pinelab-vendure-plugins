import { DefaultLogger, LogLevel, mergeConfig, Order } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import fetch from 'node-fetch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { defaultTemplate } from '../src/api/default-template';
import {
  InvoiceConfigQuery,
  MutationUpsertInvoiceConfigArgs,
  UpsertInvoiceConfigMutation,
} from '../src/ui/generated/graphql';
import {
  getConfigQuery,
  upsertConfigMutation,
} from '../src/ui/queries.graphql';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { PinelabAdminComponentsPlugin } from '../src/plugin';

describe('Invoices plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  let order: Order;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [PinelabAdminComponentsPlugin.init()],
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
      customerCount: 2,
    });
    serverStarted = true;
    await adminClient.asSuperAdmin();
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Upserts config', async () => {
    await adminClient.asSuperAdmin();
    const result = await adminClient.query<
      UpsertInvoiceConfigMutation,
      MutationUpsertInvoiceConfigArgs
    >(upsertConfigMutation, {
      input: { enabled: true, templateString: defaultTemplate },
    });
    expect(result.upsertInvoiceConfig.id).toBeDefined();
    expect(result.upsertInvoiceConfig.enabled).toBe(true);
    expect(result.upsertInvoiceConfig.templateString).toBe(defaultTemplate);
  });

  it('Gets config', async () => {
    await adminClient.asSuperAdmin();
    const result = await adminClient.query<InvoiceConfigQuery>(getConfigQuery);
    expect(result.invoiceConfig?.id).toBeDefined();
    expect(result.invoiceConfig?.enabled).toBe(true);
    expect(result.invoiceConfig?.templateString).toBe(defaultTemplate);
  });

  it('Preview fails for unauthenticated calls', async () => {
    const res = await fetch('http://localhost:3106/invoices/preview', {
      method: 'POST',
    });
    expect(res.status).toBe(403);
  });

  if (process.env.TEST_ADMIN_UI) {
    it('Should compile admin', async () => {
      const files = await getFilesInAdminUiFolder(
        __dirname,
        PinelabAdminComponentsPlugin.ui
      );
      expect(files?.length).toBeGreaterThan(0);
    }, 200000);
  }

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});
