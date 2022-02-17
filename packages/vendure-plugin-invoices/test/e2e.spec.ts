import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { InvoicePlugin } from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { addShippingMethod } from '../../test/src/admin-utils';
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import {
  InvoiceConfigQuery,
  MutationUpsertInvoiceConfigArgs,
} from '../src/ui/generated/graphql';
import {
  AllInvoicesQuery,
  UpsertInvoiceConfigMutation,
} from '../dist/ui/generated/graphql';
import { defaultTemplate } from '../src/api/default-template';
import {
  getConfigQuery,
  upsertConfigMutation,
} from '../src/ui/queries.graphql';
import { getAllInvoicesQuery } from '../dist/ui/queries.graphql';

jest.setTimeout(20000);

describe('Goedgepickt plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

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
    const order = await addPaymentToOrder(shopClient, testPaymentMethod.code);
    expect((order as any).id).toBeDefined();
  });

  it('Gets all invoices after 1s', async () => {
    // Give the worker some time to process
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await adminClient.query<AllInvoicesQuery>(
      getAllInvoicesQuery
    );
    expect(result.allInvoices[0].id).toBeDefined();
    expect(result.allInvoices[0].orderCode).toBeDefined();
    expect(result.allInvoices[0].orderId).toBeDefined();
    expect(result.allInvoices[0].customerEmail).toBe(
      'hayden.zieme12@hotmail.com'
    );
    expect(result.allInvoices[0].downloadUrl).toContain(
      '/invoices/e2e-default-channel/'
    );
  });

  it('Download PDF via URl', async () => {
    // TODO
  });

  it('Throws an error on duplicate invoices in DB', async () => {
    // TODO
  });

  it('List created invoices', async () => {
    // TODO
  });

  afterAll(() => {
    return server.destroy();
  });
});
