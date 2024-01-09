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
import { addShippingMethod } from '../../test/src/admin-utils';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  defaultTemplate,
  Invoice,
  InvoicePlugin,
  MutationUpsertInvoiceConfigArgs,
} from '../src';
import {
  getConfigQuery,
  getOrderWithInvoices,
  upsertConfigMutation,
} from '../src/ui/queries.graphql';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;
let invoice: Invoice;
let order: Order;
let invoices: Invoice[] = [];

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    apiOptions: {
      port: 3106,
    },
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      InvoicePlugin.init({
        vendureHost: 'http://localhost:3106',
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
    customerCount: 2,
  });
  serverStarted = true;
  await adminClient.asSuperAdmin();
}, 60000);

it('Should start successfully', async () => {
  await expect(serverStarted).toBe(true);
});

describe('Generate with credit invoicing enabled', function () {
  it('Upserts config', async () => {
    await adminClient.asSuperAdmin();
    const result = await adminClient.query<
      any,
      MutationUpsertInvoiceConfigArgs
    >(upsertConfigMutation, {
      input: {
        enabled: true,
        createCreditInvoices: true,
        templateString: defaultTemplate,
      },
    });
    expect(result.upsertInvoiceConfig.id).toBeDefined();
    expect(result.upsertInvoiceConfig.enabled).toBe(true);
    expect(result.upsertInvoiceConfig.createCreditInvoices).toBe(true);
    expect(result.upsertInvoiceConfig.templateString).toBe(defaultTemplate);
  });

  it('Gets config', async () => {
    await adminClient.asSuperAdmin();
    const result = await adminClient.query(getConfigQuery);
    expect(result.invoiceConfig?.id).toBeDefined();
    expect(result.invoiceConfig?.enabled).toBe(true);
    expect(result.invoiceConfig?.templateString).toBe(defaultTemplate);
  });

  it('Creates a placed order', async () => {
    await addShippingMethod(adminClient, 'manual-fulfillment');
    order = (await createSettledOrder(shopClient, 3)) as any;
    expect((order as any).id).toBeDefined();
  });

  it('Gets invoices for order', async () => {
    // Give the worker some time to process
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const { order: result } = await adminClient.query(getOrderWithInvoices, {
      id: order.id,
    });
    invoice = result.invoices[0];
    expect(invoice.id).toBeDefined();
    expect(invoice.createdAt).toBeDefined();
    expect(invoice.invoiceNumber).toBe(1);
    expect(invoice.isCreditInvoice).toBe(false);
    expect(invoice.downloadUrl).toContain(
      `/invoices/e2e-default-channel/${order.code}/1?email=hayden.zieme12%40hotmail.com`
    );
  });

  it('Emitted event for created invoice', async () => {
    expect(true).toBe(false);
  });

  it('Creates credit and new invoice on re-generate mutation', async () => {
    expect(true).toBe(false);
  });

  it('Emitted event for credit and new invoice', async () => {
    expect(true).toBe(false);
  });

  it('Has incremental invoice number for new invoice', async () => {
    await createSettledOrder(shopClient as any, 3);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const result = await adminClient.query<InvoicesQuery>(getAllInvoicesQuery);
    const newInvoice = result.invoices.items[0];
    const oldInvoice = result.invoices.items[1];
    invoices = result.invoices.items;
    expect(result.invoices.totalItems).toBe(2);
    expect(Number(newInvoice.invoiceNumber) - 1).toBe(
      Number(oldInvoice.invoiceNumber)
    );
  });
});

describe('Download invoices', function () {
  it('Downloads a pdf', async () => {
    const res = await fetch(
      `http://localhost:3106/invoices/e2e-default-channel/${order.code}?email=hayden.zieme12@hotmail.com`
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-type')).toBe('application/pdf');
    expect(res.body.pipe).toBeDefined();
  });

  it('Downloads a pdf via URL without invoice number', async () => {
    // Not specifying invoice number should download the first invoice
    const res = await fetch(
      `http://localhost:3106/invoices/e2e-default-channel/${order.code}?email=hayden.zieme12@hotmail.com`
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-type')).toBe('application/pdf');
    expect(res.body.pipe).toBeDefined();
  });

  it('Download fails for invalid email', async () => {
    const res = await fetch(
      `http://localhost:3106/invoices/e2e-default-channel/${order.code}?email=malicious@gmail.com`
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBeDefined();
  });

  it('Download fails for invalid channel', async () => {
    const res = await fetch(
      `http://localhost:3106/invoices/wrong-channel/${order.code}?email=hayden.zieme12@hotmail.com`
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBeDefined();
  });

  it('Previews a PDF', async () => {
    const res = await adminClient.fetch(
      `http://localhost:3106/invoices/preview/${order.code}`,
      {
        method: 'POST',
      }
    );
    // TODO test response
    expect(res.status).toBe(200);
  });

  it('Fails to preview for unauthenticated calls', async () => {
    const res = await fetch('http://localhost:3106/invoices/preview', {
      method: 'POST',
      body: JSON.stringify({ template: defaultTemplate }),
    });
    expect(res.status).toBe(403);
  });
});

describe('Generate without credit invoicing', function () {
  it('Disables credit invoice generation', async () => {
    await adminClient.asSuperAdmin();
    const result = await adminClient.query<
      any,
      MutationUpsertInvoiceConfigArgs
    >(upsertConfigMutation, {
      input: {
        enabled: true,
        createCreditInvoices: false,
        templateString: defaultTemplate,
      },
    });
    expect(result.upsertInvoiceConfig.id).toBeDefined();
    expect(result.upsertInvoiceConfig.enabled).toBe(true);
    expect(result.upsertInvoiceConfig.templateString).toBe(defaultTemplate);
  });

  it('Creates new invoice without credit invoice on re-generate mutation', async () => {
    expect(true).toBe(false);
  });

  it('Emitted event without credit invoice', async () => {
    expect(true).toBe(false);
  });
});

if (process.env.TEST_ADMIN_UI) {
  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(__dirname, InvoicePlugin.ui);
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);
}

afterAll(async () => {
  await server.destroy();
}, 100000);
