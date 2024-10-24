import {
  assertFound,
  DefaultLogger,
  EventBus,
  ID,
  LogLevel,
  mergeConfig,
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import fetch from 'node-fetch';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { addShippingMethod, cancelOrder } from '../../test/src/admin-utils';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  defaultTemplate,
  Invoice,
  InvoiceEntity,
  InvoicePlugin,
  MutationUpsertInvoiceConfigArgs,
} from '../src';
import { InvoiceCreatedEvent } from '../src/services/invoice-created-event';
import { getOrderWithInvoices } from '../src/ui/invoices-detail-view/invoices-detail-view';
import {
  createInvoice as createInvoiceMutation,
  exportToAccounting,
  getConfigQuery,
  upsertConfigMutation,
} from '../src/ui/queries.graphql';
import { MockAccountingStrategy } from './mock-accounting-strategy';
import gql from 'graphql-tag';
import { waitFor } from '../../test/src/test-helpers';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;
let latestInvoice: Invoice;
let order: Order;
let events: InvoiceCreatedEvent[] = [];

// Accounting strategy
const mockAccountingStrategy = new MockAccountingStrategy(
  'e2e-default-channel'
);
const mockAccountingStrategySpy = {
  init: vi.spyOn(mockAccountingStrategy, 'init'),
  exportInvoice: vi.spyOn(mockAccountingStrategy, 'exportInvoice'),
  exportCreditInvoice: vi.spyOn(mockAccountingStrategy, 'exportCreditInvoice'),
};

/**
 * Get latest invoice via admin API
 */
async function getLatestInvoice(orderId: ID): Promise<Invoice | undefined> {
  const { order: result } = await adminClient.query(getOrderWithInvoices, {
    id: orderId,
  });
  return result.invoices[0];
}

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
        licenseKey: 'BogusLicenseKey',
        accountingExports: [mockAccountingStrategy],
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
  // Listen for invoice created events
  server.app
    .get(EventBus)
    .ofType(InvoiceCreatedEvent)
    .subscribe((event) => events.push(event));
}, 30000);

it('Should start successfully', async () => {
  await expect(serverStarted).toBe(true);
});

it('Initialized accounting export strategies', async () => {
  // Has been called at least once. During test DB init its called twice, after that once
  expect(
    mockAccountingStrategySpy.init.mock.calls.length
  ).toBeGreaterThanOrEqual(1);
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
    // Keep polling until the invoice is generated
    latestInvoice = await waitFor(() => getLatestInvoice(order.id));
    expect(latestInvoice.id).toBeDefined();
    expect(latestInvoice.createdAt).toBeDefined();
    expect(latestInvoice.invoiceNumber).toBe(10001);
    expect(latestInvoice.isCreditInvoice).toBe(false);
    expect(latestInvoice.downloadUrl).toContain(
      `/invoices/e2e-default-channel/${order.code}/10001?email=hayden.zieme12%40hotmail.com`
    );
  });

  it('Emitted event for created invoice', async () => {
    const newInvoice = events[0].newInvoice;
    expect(newInvoice.createdAt).toBeDefined();
    expect(newInvoice.channelId).toBeDefined();
    expect(newInvoice.id).toBeDefined();
    expect(newInvoice.invoiceNumber).toBe(10001);
    expect(newInvoice.isCreditInvoice).toBe(false);
    expect(newInvoice.orderTotals.total).toBe(order.total);
    expect(newInvoice.orderTotals.totalWithTax).toBe(order.totalWithTax);
    expect(newInvoice.orderTotals.taxSummaries.length).toBe(2); // 20% tax + 0% shipping tax
    expect(events[0].creditInvoice).toBeUndefined();
    expect(events[0].previousInvoice).toBeUndefined();
    expect(events[1]).toBeUndefined();
  });

  it('Triggered accounting export strategy', async () => {
    const getMockCalls = () =>
      mockAccountingStrategySpy.exportInvoice.mock.calls[0];
    const [ctx, invoice, order] = await waitFor(getMockCalls);
    expect(mockAccountingStrategySpy.exportInvoice).toHaveBeenCalledTimes(1);
    expect(ctx).toBeInstanceOf(RequestContext);
    expect(invoice).toBeInstanceOf(InvoiceEntity);
    expect(invoice.isCreditInvoiceFor).toBe(null);
    expect(order).toBeInstanceOf(Order);
  });

  it('Modifies order', async () => {
    // Modify order total
    const ctx = await getSuperadminContext(server.app);
    const orderId = String(order.id).replace('T_', ''); // replace T_ prefix
    await server.app
      .get(TransactionalConnection)
      .getRepository(ctx, Order)
      .update(orderId, {
        // Ugly modification, but good enough for testing invoice regeneration
        subTotal: 1234,
        subTotalWithTax: 1480,
        shipping: 0,
        shippingWithTax: 0,
      });
    order = await assertFound(
      server.app.get(OrderService).findOne(ctx, orderId)
    );
    expect(order.total).toBe(1234);
    expect(order.totalWithTax).toBe(1480);
  });

  it('Fails to export to accounting, because order totals dont match the invoice anymore', async () => {
    await adminClient.query(exportToAccounting, {
      invoiceNumber: 10001,
    });
    // Keep polling until an invoice with an error message is generated
    const invoice = await waitFor(async () => {
      const invoice = await getLatestInvoice(1);
      if (invoice?.accountingReference?.errorMessage) {
        return invoice;
      }
    });
    expect(invoice.accountingReference?.errorMessage).toContain(
      'has changed compared to the invoice'
    );
  });

  it('Creates credit and new invoice on createInvoice mutation', async () => {
    const result = await adminClient.query(createInvoiceMutation, {
      orderId: order.id,
    });
    latestInvoice = result.createInvoice;
    expect(latestInvoice.invoiceNumber).toBe(10003); // credit invoice is #2
    expect(latestInvoice.isCreditInvoice).toBe(false);
    expect(latestInvoice.downloadUrl).toContain(
      `/invoices/e2e-default-channel/${order.code}/10003?email=hayden.zieme12%40hotmail.com`
    );
  });

  it('Emitted event for credit and new invoice', async () => {
    const newInvoice = events[1].newInvoice;
    const creditInvoice = events[1].creditInvoice!;
    const previousInvoice = events[1].previousInvoice!;
    expect(previousInvoice.invoiceNumber).toBe(10001);
    expect(creditInvoice.invoiceNumber).toBe(10002);
    expect(newInvoice.invoiceNumber).toBe(10003);
    expect(creditInvoice?.isCreditInvoice).toBe(true);
    expect(previousInvoice.isCreditInvoice).toBe(false);
    expect(newInvoice.isCreditInvoice).toBe(false);
    // Credit invoice should have the reversed totals of the previous invoice
    expect(creditInvoice.orderTotals.total).toBe(
      -previousInvoice.orderTotals.total
    );
    expect(creditInvoice.orderTotals.totalWithTax).toBe(
      -previousInvoice.orderTotals.totalWithTax
    );
    // New invoice should have the modified totals
    expect(newInvoice.orderTotals.total).toBe(1234);
    expect(newInvoice.orderTotals.totalWithTax).toBe(1480);
    expect(events[2]).toBeUndefined();
  });

  it('Triggered accounting export strategy for credit invoice', async () => {
    const [ctx, invoice, isCreditInvoiceFor, order] = await waitFor(() => {
      return mockAccountingStrategySpy.exportCreditInvoice.mock.calls[0];
    });
    expect(ctx).toBeInstanceOf(RequestContext);
    expect(invoice).toBeInstanceOf(InvoiceEntity);
    expect(isCreditInvoiceFor?.invoiceNumber).toBe(10001);
    expect(order).toBeInstanceOf(Order);
  });

  it('Triggered accounting export strategy for new invoice after credit invoice', async () => {
    const [ctx, invoice, order] = await waitFor(() => {
      return mockAccountingStrategySpy.exportInvoice.mock.calls[1];
    });
    expect(ctx).toBeInstanceOf(RequestContext);
    expect(invoice).toBeInstanceOf(InvoiceEntity);
    expect(order).toBeInstanceOf(Order);
  });

  it('Returns all invoices for order', async () => {
    const { order: result } = await adminClient.query(getOrderWithInvoices, {
      id: order.id,
    });
    const invoices: Invoice[] = result.invoices;
    // Latest invoice
    expect(invoices.length).toBe(3);
    expect(invoices[2].invoiceNumber).toBe(10001);
    // Credit invoice
    expect(invoices[1].invoiceNumber).toBe(10002);
    expect(invoices[1].isCreditInvoice).toBe(true);
    // First invoice
    expect(invoices[0].invoiceNumber).toBe(10003);
  });

  it('Exports the credit invoice to accounting again via mutation', async () => {
    const { exportInvoiceToAccountingPlatform } = await adminClient.query(gql`
      mutation {
        exportInvoiceToAccountingPlatform(invoiceNumber: 10002)
      }
    `);
    const [ctx, invoice, isCreditInvoiceFor] = await waitFor(() => {
      return mockAccountingStrategySpy.exportCreditInvoice.mock.calls[1];
    });
    expect(exportInvoiceToAccountingPlatform).toBe(true);
    expect(invoice.invoiceNumber).toBe(10002);
    expect(isCreditInvoiceFor?.invoiceNumber).toBe(10001);
  });

  it('Cancels order and creates credit invoice', async () => {
    await cancelOrder(adminClient, order as any);
    const latestInvoice = await waitFor(async () => {
      const invoice = await getLatestInvoice(order.id);
      // Only return if a creditInvoice was created, otherwise wait and try again
      if (invoice?.isCreditInvoice) {
        return invoice;
      }
    });
    expect(latestInvoice.isCreditInvoice).toBe(true);
    // Event for credit invoice should have been emitted
    expect(events[2].creditInvoice).toBeUndefined();
    expect(events[2].newInvoice.isCreditInvoice).toBe(true);
  });
});

describe('Download invoices', function () {
  it('Downloads first invoice when no invoice number is specified', async () => {
    const res = await fetch(
      `http://localhost:3106/invoices/e2e-default-channel/${order.code}?email=hayden.zieme12%40hotmail.com`
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-type')).toBe('application/pdf');
    expect(res.body.pipe).toBeDefined();
  });

  it('Downloads a pdf via URL with invoice number', async () => {
    const res = await fetch(
      `http://localhost:3106/invoices/e2e-default-channel/${order.code}/10001?email=hayden.zieme12%40hotmail.com`
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-type')).toBe('application/pdf');
    expect(res.body.pipe).toBeDefined();
  });

  it('Download fails for invalid email', async () => {
    const res = await fetch(
      `http://localhost:3106/invoices/e2e-default-channel/${order.code}?email=malicious@gmail.com`
    );
    expect(res.status).toBe(403);
  });

  it('Download fails for invalid channel', async () => {
    const res = await fetch(
      `http://localhost:3106/invoices/wrong-channel/${order.code}?email=hayden.zieme12%40hotmail.com`
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toBeDefined();
  });

  it('Previews a PDF', async () => {
    const res = await adminClient.fetch(
      `http://localhost:3106/invoices/preview/${order.code}`,
      {
        method: 'POST',
        body: JSON.stringify({ template: defaultTemplate }),
      }
    );
    expect(res.status).toBe(201);
  });

  it('Fails to preview for unauthenticated calls', async () => {
    const res = await fetch(
      `http://localhost:3106/invoices/preview/${order.code}`,
      {
        method: 'POST',
        body: JSON.stringify({ template: defaultTemplate }),
      }
    );
    expect(res.status).toBe(403);
  });
});

describe('Generate without credit invoicing', function () {
  it('Resets events', async () => {
    events = [];
  });

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
    expect(result.upsertInvoiceConfig.createCreditInvoices).toBe(false);
  });

  it('Creates settled order', async () => {
    order = (await createSettledOrder(shopClient, 3)) as any;
    expect((order as any).id).toBeDefined();
  });

  it('Created invoice', async () => {
    latestInvoice = await waitFor(() => getLatestInvoice(order.id));
    expect(latestInvoice.id).toBeDefined();
    expect(latestInvoice.createdAt).toBeDefined();
    expect(latestInvoice.invoiceNumber).toBe(10005);
    expect(latestInvoice.isCreditInvoice).toBe(false);
    expect(latestInvoice.downloadUrl).toContain(
      `/invoices/e2e-default-channel/${order.code}/10005?email=hayden.zieme12%40hotmail.com`
    );
  });

  it('Emitted event', async () => {
    expect(events[0].newInvoice).toBeDefined();
    // Previous and credit invoices should be undefined
    expect(events[0].previousInvoice).toBeUndefined();
    expect(events[0].creditInvoice).toBeUndefined();
  });

  it('Creates new invoice without credit invoice on createInvoices mutation', async () => {
    const result = await adminClient.query(createInvoiceMutation, {
      orderId: order.id,
    });
    latestInvoice = result.createInvoice;
    expect(latestInvoice.invoiceNumber).toBe(10006);
    expect(latestInvoice.isCreditInvoice).toBe(false);
    expect(latestInvoice.downloadUrl).toContain(
      `/invoices/e2e-default-channel/${order.code}/10006?email=hayden.zieme12%40hotmail.com`
    );
  });

  it('Emitted event without credit invoice', async () => {
    expect(events[1].newInvoice).toBeDefined();
    // Previous should be defined, but credit is empty because we disabled the createCreditInvoices config
    expect(events[1].previousInvoice).toBeDefined();
    expect(events[1].creditInvoice).toBeUndefined();
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
});
