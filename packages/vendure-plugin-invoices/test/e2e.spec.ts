import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  ChannelService,
  DefaultLogger,
  LogLevel,
  mergeConfig,
  Order,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { InvoicePlugin } from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import fetch from 'node-fetch';
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import {
  Invoice,
  InvoiceConfigQuery,
  MutationUpsertInvoiceConfigArgs,
} from '../src/ui/generated/graphql';
import {
  AllInvoicesQuery,
  UpsertInvoiceConfigMutation,
} from '../src/ui/generated/graphql';
import { defaultTemplate } from '../src/api/default-template';
import {
  getConfigQuery,
  upsertConfigMutation,
} from '../src/ui/queries.graphql';
import { getAllInvoicesQuery } from '../src/ui/queries.graphql';
import { InvoiceService } from '../src/api/invoice.service';

jest.setTimeout(20000);

describe('Invoices plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  let invoice: Invoice;
  let order: Order;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [InvoicePlugin.init({})],
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
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    await addItem(shopClient, 'T_1', 1);
    await addItem(shopClient, 'T_2', 2);
    await proceedToArrangingPayment(shopClient, {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: '8923CP',
        countryCode: 'NL',
      },
    });
    order = (await addPaymentToOrder(
      shopClient,
      testPaymentMethod.code
    )) as Order;
    expect((order as any).id).toBeDefined();
  });

  it('Gets all invoices after 1s', async () => {
    // Give the worker some time to process
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await adminClient.query<AllInvoicesQuery>(
      getAllInvoicesQuery
    );
    invoice = result.allInvoices[0];
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

  it('Download endpoint returns a ReadStream', async () => {
    const res = await fetch(
      `http://localhost:3106/invoices/e2e-default-channel/${order.code}?email=hayden.zieme12@hotmail.com`
    );
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

  it('List created invoices', async () => {
    // TODO
  });

  it('Create another should have incremental invoice number', async () => {
    // TODO
  });

  afterAll(() => {
    return server.destroy();
  });
});
