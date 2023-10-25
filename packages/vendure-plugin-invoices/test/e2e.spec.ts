import {
  ChannelService,
  DefaultLogger,
  LogLevel,
  mergeConfig,
  Order,
} from '@vendure/core';
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
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { InvoicePlugin } from '../src';
import { defaultTemplate } from '../src/api/default-template';
import { InvoiceService } from '../src/api/invoice.service';
import {
  Invoice,
  InvoiceConfigQuery,
  InvoicesQuery,
  MutationUpsertInvoiceConfigArgs,
  UpsertInvoiceConfigMutation,
} from '../src/ui/generated/graphql';
import {
  getAllInvoicesQuery,
  getConfigQuery,
  upsertConfigMutation,
} from '../src/ui/queries.graphql';

describe('Invoices plugin', function () {
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

  it('Creates a placed order', async () => {
    await addShippingMethod(adminClient, 'manual-fulfillment');
    order = await createSettledOrder(shopClient, 3);
    expect((order as any).id).toBeDefined();
  });

  it('Gets all invoices after 3s', async () => {
    // Give the worker some time to process
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const result = await adminClient.query<InvoicesQuery>(getAllInvoicesQuery);
    invoice = result.invoices.items[0];
    expect(result.invoices.totalItems).toBe(1);
    expect(invoice.id).toBeDefined();
    expect(invoice.orderCode).toBeDefined();
    expect(invoice.orderId).toBeDefined();
    expect(invoice.customerEmail).toBe('hayden.zieme12@hotmail.com');
    expect(invoice.downloadUrl).toContain('/invoices/e2e-default-channel/');
    expect(invoice.downloadUrl).toContain('/invoices/e2e-default-channel/');
  });

  it('Throws an error on duplicate invoices in DB', async () => {
    expect.assertions(1);
    try {
      const channel = await server.app.get(ChannelService).getDefaultChannel();
      await server.app
        .get(InvoiceService)
        .createAndSaveInvoice(channel.id as string, invoice.orderCode);
    } catch (e) {
      expect(e.message).toContain('was already created');
    }
  });

  it('Downloads a pdf', async () => {
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

  it('Has incremental invoice number', async () => {
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

  it('Download multiple invoices as zip', async () => {
    const invoiceNrs = invoices.map((i) => i.invoiceNumber);
    const res = await adminClient.fetch(
      `http://localhost:3106/invoices/download?nrs=${invoiceNrs.join(',')}`
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-type')).toBe('application/zip');
    expect(res.body.pipe).toBeDefined();
  });

  it('Download as zip fails for unauthenticated calls', async () => {
    const res = await fetch(
      'http://localhost:3106/invoices/download?nrs=1,2,3'
    );
    expect(res.status).toBe(403);
  });

  it('Preview fails for unauthenticated calls', async () => {
    const res = await fetch('http://localhost:3106/invoices/preview', {
      method: 'POST',
    });
    expect(res.status).toBe(403);
  });

  afterAll(() => {
    return server.destroy();
  });
});
