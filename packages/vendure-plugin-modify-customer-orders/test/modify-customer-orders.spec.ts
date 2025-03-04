import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  Order,
  OrderLine,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import {
  addItem,
  createSettledOrder,
  getActiveOrder,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { ModifyCustomerOrdersPlugin } from '../src';
import { convertToDraftMutation, TRANSITION_ORDER_TO } from './test-helper';
import { setAddressAndShipping } from '../../test/src/shop-utils';
import { SetShippingMethod } from '../../test/src/generated/shop-graphql';
import { getOrder } from '../../test/src/admin-utils';
import { waitFor } from '../../test/src/test-helpers';

let server: TestServer;
let adminClient: any;
let shopClient: any;
let convertedOrder: Order;
let newActiveOrder: Order;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: console,
    plugins: [
      ModifyCustomerOrdersPlugin.init({
        autoAssignDraftOrdersToCustomer: true,
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
    customerCount: 5,
  });
  await adminClient.asSuperAdmin();
}, 60000);

it('Should start successfully', async () => {
  expect(server.app.getHttpServer).toBeDefined;
});

it('Should change active order to draft order', async () => {
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  const testActiveOrder = await addItem(shopClient, 'T_1', 1);
  const res = await shopClient.query(SetShippingMethod, {
    ids: ['T_1'],
  });
  const { convertOrderToDraft: draftOrder } = await adminClient.query(
    convertToDraftMutation,
    {
      id: testActiveOrder.id,
    }
  );
  convertedOrder = draftOrder;
  const activeOrder = await addItem(shopClient, 'T_1', 1);
  expect(draftOrder.state).toBe('Draft');
  expect(draftOrder.lines.length).toBe(testActiveOrder.lines.length);
  for (let line of testActiveOrder.lines) {
    expect(
      draftOrder.lines.some(
        (l: OrderLine) => l.productVariant.id == line.productVariant.id
      )
    ).toBe(true);
  }
  expect(draftOrder.shippingAddress.fullName).toBe(
    testActiveOrder.shippingAddress.fullName
  );
  expect(draftOrder.customer.emailAddress).toBe(
    testActiveOrder.customer?.emailAddress
  );
  expect(draftOrder.code).not.toBe(activeOrder.code);
  expect(draftOrder.active).toBe(false);
});

it('Should not change non active order to draft order', async () => {
  const testNonActiveOrder = await createSettledOrder(shopClient, 1);
  try {
    await adminClient.query(convertToDraftMutation, {
      id: testNonActiveOrder.id,
    });
  } catch (e) {
    expect((e as any).response.errors[0].message).toBe(
      'Only active orders can be changed to a draft order'
    );
  }
});

it('Creates a new active order for customer', async () => {
  // We will check later if this new active order has been transitioned to draft
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  const order = await addItem(shopClient, 'T_1', 1);
  newActiveOrder = order;
  expect(order.state).toBe('AddingItems');
});

it('Assigned the draft order to customer as active order', async () => {
  // Transition order to ArrangingPayment as admin
  const { transitionOrderToState } = await adminClient.query(
    TRANSITION_ORDER_TO,
    {
      id: convertedOrder.id,
      state: 'ArrangingPayment',
    }
  );
  // Get active order as hayden
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  // Wait for async event processing
  const activeOrder = await waitFor(async () => {
    const activeOrder = await getActiveOrder(shopClient);
    if (activeOrder?.code === convertedOrder.code) {
      // We are waiting for the converted draft order to become the active order for Hayden
      // If not, retry
      return activeOrder;
    }
  }, 200);
  expect(transitionOrderToState.state).toBe('ArrangingPayment');
  expect(transitionOrderToState.active).toBe(true);
  // Completed Draft order should now be the customer's active order
  expect(transitionOrderToState.code).toBe(activeOrder?.code);
});

it('Transitioned previous active order to draft', async () => {
  const draftOrder = await getOrder(adminClient, newActiveOrder?.id);
  expect(draftOrder?.active).toBe(false);
  expect(draftOrder?.state).toBe('Draft');
});

if (process.env.TEST_ADMIN_UI) {
  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(
      __dirname,
      ModifyCustomerOrdersPlugin.ui
    );
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);
}

afterAll(async () => {
  await server.destroy();
}, 100000);
