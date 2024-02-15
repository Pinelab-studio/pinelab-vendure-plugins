import { DefaultLogger, LogLevel, mergeConfig, Order } from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
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
import { PicklistPlugin } from '../src/plugin';
import { createSettledOrder } from '../../test/src/shop-utils';

describe('Picklists plugin', function () {
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
      plugins: [PicklistPlugin],
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
    const res = await fetch('http://localhost:3106/picklists/preview', {
      method: 'POST',
    });
    expect(res.status).toBe(403);
  });

  it('Should download picklist', async () => {
    const order = await createSettledOrder(shopClient, 'T_1');
    const headers: Record<string, string> = {};
    headers['vendure-token'] = E2E_DEFAULT_CHANNEL_TOKEN;
    headers.authorization = `Bearer ${adminClient.getAuthToken()}`;
    headers['Content-Type'] = 'application/json';
    const res = await fetch(
      `http://localhost:3106/picklists/download/${order.code}`,
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'GET',
      }
    );
    expect(res.status).toBe(200);
  });

  it('Should download multiple picklists', async () => {
    const order1 = await createSettledOrder(shopClient, 'T_1');
    const order2 = await createSettledOrder(shopClient, 'T_1');
    const headers: Record<string, string> = {};
    headers['vendure-token'] = E2E_DEFAULT_CHANNEL_TOKEN;
    headers.authorization = `Bearer ${adminClient.getAuthToken()}`;
    headers['Content-Type'] = 'application/json';
    const res = await fetch(
      `http://localhost:3106/picklists/download?orderCodes=${order1.code},${order2.code}`,
      {
        headers,
        method: 'GET',
      }
    );
    expect(res.status).toBe(200);
  });

  if (process.env.TEST_ADMIN_UI) {
    it('Should compile admin', async () => {
      const files = await getFilesInAdminUiFolder(__dirname, PicklistPlugin.ui);
      expect(files?.length).toBeGreaterThan(0);
    }, 200000);
  }

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});
