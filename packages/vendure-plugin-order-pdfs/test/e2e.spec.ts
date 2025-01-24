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
import { defaultTemplate } from '../src/ui/default-template';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { createSettledOrder, SettledOrder } from '../../test/src/shop-utils';
import { OrderPDFsPlugin } from '../src';
import {
  createPDFTemplate,
  getPDFTemplates,
  updatePDFTemplate,
} from '../src/ui/queries.graphql';
import {
  CreatePdfTemplateMutation,
  CreatePdfTemplateMutationVariables,
  PdfTemplatesQuery,
  UpdatePdfTemplateMutation,
  UpdatePdfTemplateMutationVariables,
} from '../src/ui/generated/graphql';
import gql from 'graphql-tag';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;
let order: SettledOrder;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    apiOptions: {
      port: 3050,
    },
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      OrderPDFsPlugin.init({
        allowPublicDownload: true,
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

it('Creates a settled order', async () => {
  order = await createSettledOrder(shopClient, 'T_1');
});

it('Creates a private PDF template', async () => {
  await adminClient.asSuperAdmin();
  const { createPDFTemplate: template } = await adminClient.query<
    CreatePdfTemplateMutation,
    CreatePdfTemplateMutationVariables
  >(createPDFTemplate, {
    input: {
      name: 'Example PDF Template',
      enabled: true,
      public: false,
      templateString: '<html><body><h1>Example PDF</h1></body></html>',
    },
  });
  expect(template.id).toBeDefined();
  expect(template.createdAt).toBeDefined();
  expect(template.updatedAt).toBeDefined();
  expect(template.name).toBe('Example PDF Template');
  expect(template.enabled).toBe(true);
  expect(template.public).toBe(false);
  expect(template.templateString).toBe(
    '<html><body><h1>Example PDF</h1></body></html>'
  );
});

it('Gets all PDF templates as admin', async () => {
  await adminClient.asSuperAdmin();
  const { pdfTemplates } = await adminClient.query<PdfTemplatesQuery>(
    getPDFTemplates
  );
  expect(pdfTemplates.totalItems).toBe(1);
  expect(pdfTemplates.items.length).toBe(1);
  expect(pdfTemplates.items[0].name).toBe('Example PDF Template');
});

it('Downloads private PDF as admin', async () => {
  const headers = {
    'vendure-token': E2E_DEFAULT_CHANNEL_TOKEN,
    authorization: `Bearer ${adminClient.getAuthToken()}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(
    `http://localhost:3050/order-pdf/download/T_1?orderCodes=${order.code}`,
    {
      headers,
      method: 'GET',
    }
  );
  expect(res.ok).toBe(true);
});

it('Does not show up as available PDF template to customers', async () => {
  await shopClient.asAnonymousUser();
  const { availablePDFTemplates } = await shopClient.query(
    availablePDFTemplatesQuery
  );
  expect(availablePDFTemplates).toEqual([]);
});

it('Does not allow downloading of private template as customer', async () => {
  const res = await fetch(
    `http://localhost:3050/order-pdf/download/${E2E_DEFAULT_CHANNEL_TOKEN}/${order.code}/T_1/hayden.zieme12@hotmail.com`
  );
  expect(res.status).toBe(403);
});

it('Updates the PDF template to public', async () => {
  await adminClient.asSuperAdmin();
  const { updatePDFTemplate: template } = await adminClient.query<
    UpdatePdfTemplateMutation,
    UpdatePdfTemplateMutationVariables
  >(updatePDFTemplate, {
    id: 'T_1',
    input: {
      enabled: true,
      templateString: '<html>New HTML</html>',
      public: true,
      name: 'Public PDF Template',
    },
  });
  expect(template.templateString).toBe('<html>New HTML</html>');
  expect(template.public).toBe(true);
  expect(template.name).toBe('Public PDF Template');
});

it('Shows up as available PDF template', async () => {
  await shopClient.asAnonymousUser();
  const { availablePDFTemplates } = await shopClient.query(
    availablePDFTemplatesQuery
  );
  expect(availablePDFTemplates.length).toBe(1);
  expect(availablePDFTemplates[0].name).toBe('Public PDF Template');
});

it('Allows public download', async () => {
  const order1 = await createSettledOrder(shopClient, 'T_1');
  const res = await fetch(
    `http://localhost:3050/order-pdf/download/${E2E_DEFAULT_CHANNEL_TOKEN}/${order1.code}/1/hayden.zieme12@hotmail.com`,
    {
      method: 'GET',
    }
  );
  expect(res.ok).toBe(true);
});

it('Fails to preview for unauthenticated calls', async () => {
  const res = await fetch('http://localhost:3050/order-pdf/preview/', {
    method: 'POST',
    body: JSON.stringify({ template: '<html>Preview</html>' }),
  });
  expect(res.status).toBe(403);
});

it('Previews a PDF template as admin', async () => {
  const headers = {
    'vendure-token': E2E_DEFAULT_CHANNEL_TOKEN,
    authorization: `Bearer ${adminClient.getAuthToken()}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch('http://localhost:3050/order-pdf/preview/', {
    method: 'POST',
    headers,
    body: JSON.stringify({ template: '<html>Preview</html>' }),
  });
  expect(res.ok).toBe(true);
});

it('Downloads multiple PDFs as ZIP file', async () => {
  const order2 = await createSettledOrder(shopClient, 'T_1');
  const headers: Record<string, string> = {};
  headers['vendure-token'] = E2E_DEFAULT_CHANNEL_TOKEN;
  headers.authorization = `Bearer ${adminClient.getAuthToken()}`;
  headers['Content-Type'] = 'application/json';
  const res = await fetch(
    `http://localhost:3050/order-pdf/download/T_1?orderCodes=${order.code},${order2.code}`,
    {
      headers,
      method: 'GET',
    }
  );
  expect(res.ok).toBe(true);
});

if (process.env.TEST_ADMIN_UI) {
  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(__dirname, OrderPDFsPlugin.ui);
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);
}

afterAll(async () => {
  await server.destroy();
}, 100000);

export const availablePDFTemplatesQuery = gql`
  query availablePDFTemplates {
    availablePDFTemplates {
      id
      createdAt
      updatedAt
      name
    }
  }
`;
