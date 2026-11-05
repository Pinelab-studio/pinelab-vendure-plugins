import { createHmac } from 'node:crypto';
import {
  ChannelService,
  EventBus,
  type ID,
  mergeConfig,
  OrderLine,
  OrderLineEvent,
  OrderService,
  PaymentMethod,
  Product,
  ProductVariantService,
  type RequestContext,
  ShippingMethod,
  StockLocation,
} from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  type SimpleGraphQLClient,
  SqljsInitializer,
  type TestServer,
  testConfig,
} from '@vendure/testing';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import type { DocumentNode } from 'graphql';
import gql from 'graphql-tag';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cancelOrder, fulfill, getOrder } from '../../test/src/admin-utils';
import { initialData } from '../../test/src/initial-data';
import {
  addItem,
  addPaymentToOrder,
  createSettledOrder,
  proceedToArrangingPayment,
  type SettledOrder,
} from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  type HookName,
  OrderIntegrationPlugin,
  OrderIntegrationService,
  type OrderLineEventData,
} from '../src';
import {
  AcmeStrategy,
  authorizeOnlyPaymentMethod,
  MarketingStrategy,
  type RecordedInvocation,
  RecordingLogger,
  WarehouseStrategy,
} from './simulated-providers';

// The tests share one server and run in file order. Some build on earlier ones: the
// signed-webhook tests use the eu/us channels of the channel test. Run the whole file.
const warehouse = new WarehouseStrategy();
const marketing = new MarketingStrategy();
const acme = new AcmeStrategy();
const recordingLogger = new RecordingLogger();

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let ctx: RequestContext;
/** The order of the golden path test, which later tests expect `acme` to ignore. */
let goldenPathOrderId: number;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: recordingLogger,
    plugins: [
      OrderIntegrationPlugin.init({
        strategies: [
          warehouse,
          marketing,
          acme,
          {
            name: 'disabled',
            isEnabled: () => false,
            onOrderCreated: () => {},
            onOrderUpdated: () => {},
            onOrderStateTransition: () => {},
          },
        ],
        retries: 2,
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod, authorizeOnlyPaymentMethod],
    },
    // Set by the signed acme webhook
    customFields: {
      Order: [{ name: 'integrationStatus', type: 'string', nullable: true }],
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
        {
          name: authorizeOnlyPaymentMethod.code,
          handler: { code: authorizeOnlyPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
  await adminClient.asSuperAdmin();
  ctx = await getSuperadminContext(server.app);
}, 60000);

afterAll(async () => {
  await server.destroy();
}, 30000);

it('Delivers order creation before the cart is placed', async () => {
  await loginAsCustomer();
  const cart = await addItem(shopClient, 'T_1', 1);
  const orderId = toEntityId(cart.id);

  const creation = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onOrderCreated')[0],
  );
  await waitForAllJobsSettled();

  expect(creation.event.orderIds).toEqual([orderId]);
  expect(creation.event.data).toEqual({});
  expect(warehouse.invocationsFor(orderId, 'onOrderCreated')).toHaveLength(1);
  expect(await findJobs('warehouse', orderId, 'onOrderCreated')).toMatchObject([
    { state: 'COMPLETED' },
  ]);
  expect(warehouse.invocationsFor(orderId, 'onOrderPlaced')).toEqual([]);

  // Leave the customer without an active cart for the following cases.
  await checkout();
});

it('Delivers onOrderPlaced with the original transition to every strategy that implements it', async () => {
  const before = new Date();
  const order = await createSettledOrder(shopClient, 1, true);
  const after = new Date();
  const orderId = toEntityId(order.id);
  goldenPathOrderId = orderId;

  const warehouseInvocation = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onOrderPlaced')[0],
  );
  const marketingInvocation = await waitFor(
    () => marketing.invocationsFor(orderId, 'onOrderPlaced')[0],
  );
  const eventId = warehouseInvocation.event.eventId;
  expect(eventId).toMatch(UUID_PATTERN);
  expect(marketingInvocation.event.eventId).toBe(eventId);
  for (const invocation of [warehouseInvocation, marketingInvocation]) {
    expect(invocation.event.data).toEqual({
      fromState: 'ArrangingPayment',
      toState: 'PaymentSettled',
    });
    expect(invocation.event.orderIds).toEqual([orderId]);
    expect(invocation.channelToken).toBe('e2e-default-channel');
    expect(invocation.languageCode).toBe('en');
    expect(invocation.event.occurredAt).toBe(
      new Date(invocation.event.occurredAt).toISOString(),
    );
    const occurredAt = new Date(invocation.event.occurredAt).getTime();
    expect(occurredAt).toBeGreaterThanOrEqual(before.getTime());
    expect(occurredAt).toBeLessThanOrEqual(after.getTime());
  }
  expect(warehouseInvocation.event.route).toEqual({
    strategyName: 'warehouse',
  });
  expect(marketingInvocation.event.route).toEqual({
    strategyName: 'marketing',
  });

  // Each strategy maps the order to its own request
  const warehouseRequest = await waitFor(() =>
    warehouse.client.requests.find(
      (request) =>
        request.idempotencyKey === `warehouse:1:onOrderPlaced:${eventId}`,
    ),
  );
  expect(warehouseRequest).toEqual({
    idempotencyKey: `warehouse:1:onOrderPlaced:${eventId}`,
    payload: {
      orderCode: order.code,
      hook: 'onOrderPlaced',
      skus: ['L2201308', 'L2201508'],
    },
  });
  const marketingRequest = await waitFor(() =>
    marketing.client.requests.find(
      (request) =>
        request.idempotencyKey === `marketing:1:onOrderPlaced:${eventId}`,
    ),
  );
  expect(marketingRequest).toEqual({
    idempotencyKey: `marketing:1:onOrderPlaced:${eventId}`,
    payload: {
      event: 'Placed Order',
      orderCode: order.code,
      email: 'hayden.zieme12@hotmail.com',
      value: order.totalWithTax,
    },
  });
  // The strategy loaded the order through the OrderService it got in init()
  expect(warehouseInvocation.loadedOrderCode).toBe(order.code);

  const warehouseJob = await waitForJob(
    'warehouse',
    'onOrderPlaced',
    orderId,
    'COMPLETED',
  );
  expect(warehouseJob.result).toEqual({
    strategyName: 'warehouse',
    hook: 'onOrderPlaced',
    eventId,
    orderIds: [orderId],
  });
  const marketingJob = await waitForJob(
    'marketing',
    'onOrderPlaced',
    orderId,
    'COMPLETED',
  );
  expect(marketingJob.result).toEqual({
    strategyName: 'marketing',
    hook: 'onOrderPlaced',
    eventId,
    orderIds: [orderId],
  });
});

it('Rejects two strategies with the same name', () => {
  expect(() =>
    OrderIntegrationPlugin.init({
      strategies: [new WarehouseStrategy(), new WarehouseStrategy()],
    }),
  ).toThrow('warehouse');
});

it('Delivers cart changes and transitions without replaying them at placement', async () => {
  const cart = await createCartWithTwoLines();
  const orderId = toEntityId(cart.id);
  const t1LineId = lineIdFor(cart, 'T_1');
  const t2LineId = lineIdFor(cart, 'T_2');
  await mutate(shopClient, ADJUST_ORDER_LINE, {
    orderLineId: t2LineId,
    quantity: 3,
  });
  await mutate(shopClient, REMOVE_ORDER_LINE, { orderLineId: t1LineId });
  await mutate(adminClient, SET_ORDER_CUSTOM_FIELDS, {
    input: { id: cart.id, customFields: { integrationStatus: 'cart-updated' } },
  });
  const transition = await proceedToArrangingPayment(shopClient, 1, {
    input: {
      fullName: 'Cart Customer',
      streetLine1: 'Teststraat 1',
      city: 'Leeuwarden',
      postalCode: '8923CP',
      countryCode: 'NL',
    },
  });
  expect(transition && 'errorCode' in transition).toBe(false);

  await waitFor(
    () => warehouse.invocationsFor(orderId, 'onOrderStateTransition')[0],
  );
  await waitForAllJobsSettled();
  expectSameMembers(
    warehouse.invocationsFor(orderId, 'onOrderLineCreated').map(lineDataOf),
    [
      expect.objectContaining({ lineId: toEntityId(t1LineId) }),
      expect.objectContaining({ lineId: toEntityId(t2LineId) }),
    ],
  );
  expect(
    warehouse.invocationsFor(orderId, 'onOrderLineUpdated').map(lineDataOf),
  ).toContainEqual(
    expect.objectContaining({
      lineId: toEntityId(t2LineId),
      lineSnapshot: expect.objectContaining({ quantity: 3 }),
    }),
  );
  expect(warehouse.invocationsFor(orderId, 'onOrderLineDeleted')).toMatchObject(
    [{ event: { data: { lineId: toEntityId(t1LineId) } } }],
  );
  expect(warehouse.invocationsFor(orderId, 'onOrderUpdated')).toMatchObject([
    {
      event: {
        input: {
          customFields: { integrationStatus: 'cart-updated' },
        },
      },
    },
  ]);
  expect(transitionsOf(warehouse, orderId)).toContain(
    'AddingItems -> ArrangingPayment',
  );
  expect(warehouse.invocationsFor(orderId, 'onOrderPlaced')).toEqual([]);
  const cartHooks = hooksOf(warehouse, orderId).filter(
    (hook) => hook !== 'onOrderStateTransition',
  );

  const order = await addPaymentToOrder(shopClient, 'test-payment-method');
  expect(order).toMatchObject({ id: cart.id });
  await waitFor(() => marketing.invocationsFor(orderId, 'onOrderPlaced')[0]);
  await waitForAllJobsSettled();
  expectSameMembers(
    hooksOf(warehouse, orderId).filter(
      (hook) =>
        hook !== 'onOrderStateTransition' &&
        hook !== 'onOrderPlaced' &&
        hook !== 'onPaymentStateTransition',
    ),
    cartHooks,
  );
});

it('Creates no order-hook jobs for disabled strategies or missing hooks', async () => {
  await loginAsCustomer();
  const cart = await addItem(shopClient, 'T_1', 1);
  const orderId = toEntityId(cart.id);
  await mutate(adminClient, SET_ORDER_CUSTOM_FIELDS, {
    input: { id: cart.id, customFields: { integrationStatus: 'eligibility' } },
  });
  await checkout();
  await waitFor(() => warehouse.invocationsFor(orderId, 'onOrderPlaced')[0]);
  await waitForAllJobsSettled();

  for (const [hook, count] of [
    ['onOrderCreated', 1],
    ['onOrderUpdated', 1],
    ['onOrderStateTransition', 3],
  ] as const) {
    expect(await findJobs('warehouse', orderId, hook)).toHaveLength(count);
    expect(await findJobs('marketing', orderId, hook)).toEqual([]);
  }
  expect(await findJobs('disabled', orderId)).toEqual([]);
});

it('Completes the job without a provider request for an order the strategy excludes', async () => {
  const order = await createSettledOrder(
    shopClient,
    1,
    true,
    [{ id: 'T_1', quantity: 1 }],
    undefined,
    {
      input: {
        fullName: 'Excluded Customer',
        streetLine1: 'Teststraat 1',
        city: 'Brussel',
        postalCode: '1000',
        countryCode: 'BE',
      },
    },
  );
  const orderId = toEntityId(order.id);

  // marketing's request for the same event is the positive control
  await waitFor(() => marketing.client.requestsForOrder(order.code)[0]);
  const warehouseJob = await waitForJob(
    'warehouse',
    'onOrderPlaced',
    orderId,
    'COMPLETED',
  );
  expect(warehouseJob.attempts).toBe(1);
  await waitForAllJobsSettled();

  expect(warehouse.invocationsFor(orderId, 'onOrderPlaced')).toHaveLength(1);
  expect(warehouse.client.requestsForOrder(order.code)).toEqual([]);
  expect(marketing.client.requestsForOrder(order.code)).toHaveLength(1);
});

it('Dispatches to a strategy only for its channels, with the channel and language of the event', async () => {
  await createChannelsEuAndUs();
  const euOrder = await createSettledOrderInChannel('eu');
  const usOrder = await createSettledOrderInChannel('us');
  const euOrderId = toEntityId(euOrder.id);
  const usOrderId = toEntityId(usOrder.id);

  await waitFor(() => acme.invocationsFor(euOrderId, 'onOrderPlaced')[0]);
  await waitFor(() => acme.invocationsFor(usOrderId, 'onOrderPlaced')[0]);
  await waitFor(() => acme.clients.eu.requestsForOrder(euOrder.code)[0]);
  await waitFor(() => acme.clients.us.requestsForOrder(usOrder.code)[0]);
  await waitFor(() => warehouse.invocationsFor(euOrderId, 'onOrderPlaced')[0]);
  await waitFor(() => warehouse.invocationsFor(usOrderId, 'onOrderPlaced')[0]);
  await waitForAllJobsSettled();

  // Each order reaches only the client of its own account
  expect(acme.clients.eu.requestsForOrder(euOrder.code)).toHaveLength(1);
  expect(acme.clients.us.requestsForOrder(euOrder.code)).toEqual([]);
  expect(acme.clients.us.requestsForOrder(usOrder.code)).toHaveLength(1);
  expect(acme.clients.eu.requestsForOrder(usOrder.code)).toEqual([]);
  // Hooks run with the channel and language of the event
  expect(summarize(acme.invocationsFor(euOrderId))).toEqual([
    { hook: 'onOrderPlaced', channelToken: 'eu', languageCode: 'en' },
  ]);
  expect(summarize(acme.invocationsFor(usOrderId))).toEqual([
    { hook: 'onOrderPlaced', channelToken: 'us', languageCode: 'en' },
  ]);
  // warehouse has no isEnabled, so it received both orders
  expect(
    summarize(warehouse.invocationsFor(euOrderId, 'onOrderPlaced')),
  ).toEqual([
    { hook: 'onOrderPlaced', channelToken: 'eu', languageCode: 'en' },
  ]);
  expect(
    summarize(warehouse.invocationsFor(usOrderId, 'onOrderPlaced')),
  ).toEqual([
    { hook: 'onOrderPlaced', channelToken: 'us', languageCode: 'en' },
  ]);
  // The default channel is not enabled for acme
  expect(acme.invocationsFor(goldenPathOrderId)).toEqual([]);
  expect(await findJobs('acme', goldenPathOrderId)).toEqual([]);
});

it('Logs a throwing isEnabled and still dispatches to the other strategies', async () => {
  acme.throwInIsEnabled = true;
  try {
    const order = await createSettledOrderInChannel('eu');
    const orderId = toEntityId(order.id);

    await waitFor(() => warehouse.invocationsFor(orderId, 'onOrderPlaced')[0]);
    await waitFor(() => marketing.invocationsFor(orderId, 'onOrderPlaced')[0]);
    await waitFor(() =>
      recordingLogger.errors.find(
        (entry) =>
          entry.context === 'OrderIntegrationPlugin' &&
          entry.message.includes('acme'),
      ),
    );
    await waitForAllJobsSettled();

    expect(acme.invocationsFor(orderId)).toEqual([]);
    expect(await findJobs('acme', orderId)).toEqual([]);
  } finally {
    acme.throwInIsEnabled = false;
  }
});

it('Delivers payment and refund transitions of an authorize-only payment', async () => {
  const order = await createSettledOrder(
    shopClient,
    1,
    true,
    [{ id: 'T_1', quantity: 1 }],
    undefined,
    undefined,
    'authorize-only',
  );
  const orderId = toEntityId(order.id);
  const paymentId = firstPaymentId(order);

  // Checkout delivers both payment authorization and order placement
  const placed = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onOrderPlaced')[0],
  );
  expect(placed.event.data).toEqual({
    fromState: 'ArrangingPayment',
    toState: 'PaymentAuthorized',
  });
  await waitForAllJobsSettled();
  expect(
    warehouse.invocationsFor(orderId, 'onPaymentStateTransition'),
  ).toMatchObject([
    {
      event: {
        data: {
          paymentId: toEntityId(paymentId),
          fromState: 'Created',
          toState: 'Authorized',
        },
      },
    },
  ]);

  await mutate(adminClient, SETTLE_PAYMENT, { id: paymentId });
  const settled = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onPaymentStateTransition')[1],
  );
  expect(settled.event.data).toEqual({
    paymentId: toEntityId(paymentId),
    fromState: 'Authorized',
    toState: 'Settled',
  });
  await waitFor(() =>
    transitionsOf(warehouse, orderId).includes(
      'PaymentAuthorized -> PaymentSettled',
    ),
  );

  const refund = await refundPayment(paymentId, 500);
  const refundCreated = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onRefundCreated')[0],
  );
  expect(refundCreated.event.data).toMatchObject({
    refundId: toEntityId(refund.id),
    snapshot: { state: 'Pending', total: 500, reason: 'Customer request' },
  });

  await mutate(adminClient, SETTLE_REFUND, {
    input: { id: refund.id, transactionId: 'REFUND-1' },
  });
  const refundSettled = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onRefundStateTransition')[0],
  );
  expect(refundSettled.event.data).toEqual({
    refundId: toEntityId(refund.id),
    fromState: 'Pending',
    toState: 'Settled',
  });
  await waitForAllJobsSettled();
  expect(
    warehouse.invocationsFor(orderId, 'onPaymentStateTransition'),
  ).toHaveLength(2);
  expect(warehouse.invocationsFor(orderId, 'onRefundCreated')).toHaveLength(1);
  expect(
    warehouse.invocationsFor(orderId, 'onRefundStateTransition'),
  ).toHaveLength(1);
  expectSameMembers(transitionsOf(warehouse, orderId), [
    'Created -> AddingItems',
    'AddingItems -> ArrangingPayment',
    'ArrangingPayment -> PaymentAuthorized',
    'PaymentAuthorized -> PaymentSettled',
  ]);
});

it('Delivers the order update and the line events of a modification', async () => {
  const order = await createSettledOrder(shopClient, 1, true);
  const orderId = toEntityId(order.id);
  const t2LineId = lineIdFor(order, 'T_2');
  await waitFor(() => warehouse.invocationsFor(orderId, 'onOrderPlaced')[0]);
  await waitForAllJobsSettled();
  const priorCount = warehouse.invocationsFor(orderId).length;

  await mutate(adminClient, TRANSITION_ORDER_TO_STATE, {
    id: order.id,
    state: 'Modifying',
  });
  const modified = await mutate<ModifiedOrder>(adminClient, MODIFY_ORDER, {
    input: {
      dryRun: false,
      orderId: order.id,
      addItems: [{ productVariantId: 'T_3', quantity: 1 }],
      adjustOrderLines: [{ orderLineId: t2LineId, quantity: 3 }],
    },
  });
  const t3LineId = lineIdFor(modified, 'T_3');
  await mutate(adminClient, TRANSITION_ORDER_TO_STATE, {
    id: order.id,
    state: 'ArrangingAdditionalPayment',
  });
  const withAdditionalPayment = await mutate<ModifiedOrder>(
    adminClient,
    ADD_MANUAL_PAYMENT,
    {
      input: {
        orderId: order.id,
        method: 'test-payment-method',
        transactionId: 'MOD-1',
        metadata: {},
      },
    },
  );
  const additionalPaymentIds = withAdditionalPayment.payments
    .map((payment) => payment.id)
    .filter((paymentId) => paymentId !== firstPaymentId(order));
  expect(additionalPaymentIds).toHaveLength(1);
  await mutate(adminClient, TRANSITION_ORDER_TO_STATE, {
    id: order.id,
    state: 'PaymentSettled',
  });

  await waitFor(() =>
    transitionsOf(warehouse, orderId).includes(
      'ArrangingAdditionalPayment -> PaymentSettled',
    ),
  );
  await waitForAllJobsSettled();
  const modification = warehouse.invocationsFor(orderId).slice(priorCount);

  // The update carries the modification input as it was supplied
  const updates = warehouse.invocationsFor(orderId, 'onOrderUpdated');
  expect(updates).toHaveLength(1);
  expect(updates[0].event.data).toEqual({});
  expect(updates[0].event.input).toEqual({
    dryRun: false,
    orderId,
    addItems: [{ productVariantId: 3, quantity: 1 }],
    adjustOrderLines: [{ orderLineId: toEntityId(t2LineId), quantity: 3 }],
  });
  // A new line fires created and updated, both with its final values
  const t3Snapshot = {
    id: toEntityId(t3LineId),
    productVariantId: 3,
    quantity: 1,
    unitPrice: 900,
    unitPriceWithTax: 1080,
    linePrice: 900,
    linePriceWithTax: 1080,
  };
  const created = modification.filter(
    ({ hook }) => hook === 'onOrderLineCreated',
  );
  expect(created).toHaveLength(1);
  expect(created[0].event.data).toMatchObject({
    lineId: toEntityId(t3LineId),
    lineSnapshot: t3Snapshot,
  });
  const updated = modification.filter(
    ({ hook }) => hook === 'onOrderLineUpdated',
  );
  expect(updated).toHaveLength(2);
  const t3Updated = updated.find(
    (invocation) => lineDataOf(invocation).lineId === toEntityId(t3LineId),
  );
  expect(t3Updated?.event.data).toEqual(created[0].event.data);
  const t2Updated = updated.find(
    (invocation) => lineDataOf(invocation).lineId === toEntityId(t2LineId),
  );
  expect(t2Updated?.event.data).toMatchObject({
    lineSnapshot: {
      id: toEntityId(t2LineId),
      productVariantId: 2,
      quantity: 3,
    },
  });
  // The additional payment
  const payments = modification.filter(
    ({ hook }) => hook === 'onPaymentStateTransition',
  );
  expect(payments).toHaveLength(1);
  expect(payments[0].event.data).toEqual({
    paymentId: toEntityId(additionalPaymentIds[0]),
    fromState: 'Created',
    toState: 'Settled',
  });
  expectSameMembers(transitionsOf(warehouse, orderId), [
    'Created -> AddingItems',
    'AddingItems -> ArrangingPayment',
    'ArrangingPayment -> PaymentSettled',
    'PaymentSettled -> Modifying',
    'Modifying -> ArrangingAdditionalPayment',
    'ArrangingAdditionalPayment -> PaymentSettled',
  ]);
});

it('Delivers cancelled lines with their values before the cancellation', async () => {
  const order = await createSettledOrder(shopClient, 1, true, [
    { id: 'T_2', quantity: 3 },
  ]);
  const orderId = toEntityId(order.id);
  const lineId = lineIdFor(order, 'T_2');

  expect(
    await cancelOrder(adminClient, {
      id: order.id,
      lines: [{ id: lineId, quantity: 1 }],
    }),
  ).toMatchObject({ id: order.id, state: 'PaymentSettled' });
  const partial = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onOrderLineCancelled')[0],
  );
  expect(partial.event.data).toMatchObject({
    lineId: toEntityId(lineId),
    lineSnapshot: { id: toEntityId(lineId), quantity: 3, cancelledQuantity: 1 },
  });
  expect(partial.event.input).toBeUndefined();
  await waitForAllJobsSettled();
  // marketing has no line hooks: its only job for this order is the placement
  expect(
    (await findJobs('marketing', orderId)).map((job) => job.data.hook),
  ).toEqual(['onOrderPlaced']);

  // Cancelling the remaining quantity cancels the whole order
  const reloaded = await reloadOrder(order.id);
  expect(reloaded.lines[0].quantity).toBe(2);
  expect(await cancelOrder(adminClient, reloaded)).toMatchObject({
    id: order.id,
    state: 'Cancelled',
  });
  await waitFor(() =>
    transitionsOf(warehouse, orderId).includes('PaymentSettled -> Cancelled'),
  );
  await waitForAllJobsSettled();
  const cancellations = warehouse.invocationsFor(
    orderId,
    'onOrderLineCancelled',
  );
  expect(cancellations).toHaveLength(2);
  expect(cancellations[1].event.data).toMatchObject({
    lineId: toEntityId(lineId),
    lineSnapshot: { quantity: 2, cancelledQuantity: 2 },
  });
  expectSameMembers(transitionsOf(warehouse, orderId), [
    'Created -> AddingItems',
    'AddingItems -> ArrangingPayment',
    'ArrangingPayment -> PaymentSettled',
    'PaymentSettled -> Cancelled',
  ]);
});

it('Delivers deleted lines of carts and placed orders', async () => {
  // Vendure deletes lines only in AddingItems or Draft, so the event is published here
  const cart = await createCartWithTwoLines();
  const orderId = toEntityId(cart.id);
  const t2LineId = lineIdFor(cart, 'T_2');
  await publishDeletedLineEvent(orderId, toEntityId(t2LineId));
  const order = await checkout();

  // marketing's onOrderPlaced for this order is the positive control
  await waitFor(() => marketing.invocationsFor(orderId, 'onOrderPlaced')[0]);
  await waitForAllJobsSettled();
  expect(warehouse.invocationsFor(orderId, 'onOrderLineDeleted')).toMatchObject(
    [{ event: { data: { lineId: toEntityId(t2LineId) } } }],
  );

  await publishDeletedLineEvent(orderId, toEntityId(t2LineId));
  const deleted = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onOrderLineDeleted')[1],
  );
  expect(order.id).toBe(cart.id);
  expect(deleted.event.orderIds).toEqual([orderId]);
  expect(deleted.event.data).toMatchObject({
    lineId: toEntityId(t2LineId),
    lineSnapshot: {
      id: toEntityId(t2LineId),
      productVariantId: 2,
      quantity: 2,
      orderPlacedQuantity: 2,
      unitPrice: 139900,
      unitPriceWithTax: 167880,
      linePrice: 279800,
      linePriceWithTax: 335760,
    },
  });
  await waitForAllJobsSettled();
  expect(warehouse.invocationsFor(orderId, 'onOrderLineDeleted')).toHaveLength(
    2,
  );
});

it('Delivers a fulfillment and its transitions for a placed order', async () => {
  const order = await createSettledOrder(shopClient, 1, true);
  const orderId = toEntityId(order.id);
  const lines = order.lines.map((line) => ({
    orderLineId: toEntityId(line.id),
    quantity: line.quantity,
  }));

  const fulfillment = await fulfill(
    adminClient,
    'manual-fulfillment',
    order.lines.map((line): [string, number] => [line.id, line.quantity]),
    [
      { name: 'method', value: 'Test method' },
      { name: 'trackingCode', value: 'TRACK-1' },
    ],
  );
  expect(fulfillment.state).toBe('Pending');
  const fulfillmentId = toEntityId(fulfillment.id);
  const created = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onFulfillmentCreated')[0],
  );
  expect(created.event.orderIds).toEqual([orderId]);
  expect(created.event.data).toMatchObject({
    fulfillmentId,
    snapshot: {
      state: 'Created',
      handlerCode: 'manual-fulfillment',
      method: 'Test method',
      trackingCode: 'TRACK-1',
      lines,
    },
  });
  await waitFor(
    () => warehouse.invocationsFor(orderId, 'onFulfillmentStateTransition')[0],
  );

  await mutate(adminClient, TRANSITION_FULFILLMENT_TO_STATE, {
    id: fulfillment.id,
    state: 'Shipped',
  });
  await waitFor(() =>
    transitionsOf(warehouse, orderId).includes('PaymentSettled -> Shipped'),
  );
  await waitForAllJobsSettled();

  const transitions = warehouse.invocationsFor(
    orderId,
    'onFulfillmentStateTransition',
  );
  expectSameMembers(
    transitions.map((invocation) => invocation.event.data),
    [
      { fulfillmentId, fromState: 'Created', toState: 'Pending' },
      { fulfillmentId, fromState: 'Pending', toState: 'Shipped' },
    ],
  );
  for (const invocation of transitions) {
    expect(invocation.event.orderIds).toEqual([orderId]);
  }
  expect(
    warehouse.invocationsFor(orderId, 'onFulfillmentCreated'),
  ).toHaveLength(1);
});

it('Retries a failed hook with the captured event and lets the provider deduplicate', async () => {
  const order = await createSettledOrder(shopClient, 1, true);
  const orderId = toEntityId(order.id);
  await waitForAllJobsSettled();

  // The first attempt sends its request, settles the refund, and then fails
  let refundId: string | undefined;
  warehouse.failOrder(order.code, 'onRefundCreated', {
    times: 1,
    beforeFailing: async () => {
      const id = await waitFor(() => refundId);
      await mutate(adminClient, SETTLE_REFUND, {
        input: { id, transactionId: 'REFUND-1' },
      });
    },
  });
  const before = new Date();
  const refund = await refundPayment(firstPaymentId(order), 500);
  const after = new Date();
  refundId = refund.id;

  await waitFor(
    () => warehouse.invocationsFor(orderId, 'onRefundCreated').length === 2,
  );
  const [first, second] = warehouse.invocationsFor(orderId, 'onRefundCreated');
  expect(second.event).toStrictEqual(first.event);
  // The refund has been settled since, but the retry still sees it as it was created
  expect(second.event.data).toMatchObject({
    refundId: toEntityId(refund.id),
    snapshot: { state: 'Pending' },
  });
  const occurredAt = new Date(second.event.occurredAt).getTime();
  expect(occurredAt).toBeGreaterThanOrEqual(before.getTime());
  expect(occurredAt).toBeLessThanOrEqual(after.getTime());

  // The provider got the request twice and applied it once
  const idempotencyKey = `warehouse:1:onRefundCreated:${first.event.eventId}`;
  expect(
    warehouse.client.requests.filter(
      (request) => request.idempotencyKey === idempotencyKey,
    ),
  ).toHaveLength(2);
  expect(
    warehouse.client.effects.filter(
      (request) => request.idempotencyKey === idempotencyKey,
    ),
  ).toHaveLength(1);
  const job = await waitForJob(
    'warehouse',
    'onRefundCreated',
    orderId,
    'COMPLETED',
  );
  expect(job.attempts).toBe(2);
});

it('Fails the job after the last attempt, logs every attempt and leaves other strategies alone', async () => {
  // The order code is known before checkout, so the failure can be planned up front
  await loginAsCustomer();
  const cart = await addItem(shopClient, 'T_1', 1);
  warehouse.failOrder(cart.code, 'onOrderPlaced');
  const order = await checkout();
  const orderId = toEntityId(order.id);

  const failedJob = await waitForJob(
    'warehouse',
    'onOrderPlaced',
    orderId,
    'FAILED',
  );
  expect(failedJob.attempts).toBe(3);
  expect(failedJob.error).toBe('Simulated provider outage');
  expect(warehouse.invocationsFor(orderId, 'onOrderPlaced')).toHaveLength(3);

  const marketingJob = await waitForJob(
    'marketing',
    'onOrderPlaced',
    orderId,
    'COMPLETED',
  );
  expect(marketingJob.error).toBeNull();
  const loggedErrors = recordingLogger.errors.filter(
    (entry) =>
      entry.context === 'OrderIntegrationPlugin' &&
      entry.message.includes(cart.code),
  );
  expect(loggedErrors).toHaveLength(3);
});

it('Enqueues a hook programmatically for an unplaced order', async () => {
  await loginAsCustomer();
  const cart = await addItem(shopClient, 'T_1', 1);
  const orderId = toEntityId(cart.id);
  const service = server.app.get(OrderIntegrationService);

  const jobs = await service.enqueue(ctx, 'onOrderUpdated', {
    orderIds: [orderId],
    data: {},
    input: { customFields: { integrationStatus: 'manual' } },
  });

  expect(jobs).toHaveLength(1);
  await waitForJob('warehouse', 'onOrderUpdated', orderId, 'COMPLETED');
  expect(warehouse.invocationsFor(orderId, 'onOrderUpdated')).toMatchObject([
    {
      event: {
        orderIds: [orderId],
        input: {
          customFields: { integrationStatus: 'manual' },
        },
      },
    },
  ]);
  await checkout();
});

it('Enqueues hooks programmatically through the same pipeline', async () => {
  const service = server.app.get(OrderIntegrationService);
  const data = { fromState: 'ArrangingPayment', toState: 'PaymentSettled' };

  await loginAsCustomer();
  await addItem(shopClient, 'T_1', 1);

  const order = await checkout();
  const orderId = toEntityId(order.id);
  const placement = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onOrderPlaced')[0],
  );
  await waitFor(() => marketing.invocationsFor(orderId, 'onOrderPlaced')[0]);
  await waitForAllJobsSettled();

  // Every enabled strategy that implements the hook gets the supplied data
  const jobs = await service.enqueue(ctx, 'onOrderPlaced', {
    orderIds: [orderId],
    data,
  });
  expect(jobs).toHaveLength(2);
  await waitFor(
    () => warehouse.invocationsFor(orderId, 'onOrderPlaced').length === 2,
  );
  await waitFor(
    () => marketing.invocationsFor(orderId, 'onOrderPlaced').length === 2,
  );
  const warehouseEnqueued = warehouse.invocationsFor(
    orderId,
    'onOrderPlaced',
  )[1];
  const marketingEnqueued = marketing.invocationsFor(
    orderId,
    'onOrderPlaced',
  )[1];
  expect(warehouseEnqueued.event.data).toEqual(data);
  expect(marketingEnqueued.event.data).toEqual(data);
  expect(warehouseEnqueued.event.eventId).toMatch(UUID_PATTERN);
  expect(warehouseEnqueued.event.eventId).not.toBe(placement.event.eventId);
  expect(marketingEnqueued.event.eventId).toBe(warehouseEnqueued.event.eventId);

  // An unknown strategy is rejected
  await expect(
    service.enqueue(
      ctx,
      'onOrderPlaced',
      { orderIds: [orderId], data },
      { strategyName: 'nope' },
    ),
  ).rejects.toThrow('nope');

  // A route targets one strategy and its connection
  await service.enqueue(
    ctx,
    'onOrderPlaced',
    { orderIds: [orderId], data },
    { strategyName: 'warehouse', connectionId: 'eu' },
  );
  const targeted = await waitFor(
    () => warehouse.invocationsFor(orderId, 'onOrderPlaced')[2],
  );
  expect(targeted.event.route).toEqual({
    strategyName: 'warehouse',
    connectionId: 'eu',
  });
  await waitForAllJobsSettled();
  expect(marketing.invocationsFor(orderId, 'onOrderPlaced')).toHaveLength(2);
});

describe('Webhook routing', () => {
  beforeEach(() => warehouse.resetWebhooks());

  it.each([
    ['an unknown strategy', 'unknown/eu'],
    ['a strategy without onWebhookReceived', 'marketing/eu'],
    ['a missing connection id', 'warehouse'],
  ])('Answers 404 for %s without invoking a strategy', async (_case, path) => {
    const response = await sendWebhook(path, {
      method: 'POST',
      body: 'payload',
    });

    expect(response.status).toBe(404);
    expect(warehouse.webhookRequests).toEqual([]);
  });

  it('Hands the request to the strategy with the route values of the URL', async () => {
    const response = await sendWebhook('warehouse/eu', {
      method: 'POST',
      body: 'payload',
    });

    expect(response.status).toBe(200);
    expect(warehouse.webhookRequests).toHaveLength(1);
    expect(warehouse.webhookRequests[0].route).toEqual({
      strategyName: 'warehouse',
      connectionId: 'eu',
    });
  });
});

describe('Webhook request and response', () => {
  beforeEach(() => warehouse.resetWebhooks());

  it('Passes the exact bytes of the body to the strategy', async () => {
    await sendWebhook('warehouse/eu', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Uint8Array.from([0, 255, 128, 10, 123]),
    });

    expect(toHex(warehouse.webhookRequests[0].rawBody)).toBe('00ff800a7b');
    expect(warehouse.webhookRequests[0].body).toBeUndefined();
  });

  it('Passes the parsed JSON body next to the unchanged raw bytes', async () => {
    // Whitespace and a unicode escape that re-serializing the parsed body would change
    const sent = '{ "orderCode":"A-1",\n  "note":"caf\\u00e9" }';

    await sendWebhook('warehouse/eu?source=acme', {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-acme-signature': 'abc123',
      },
      body: sent,
    });

    const [request] = warehouse.webhookRequests;
    expect(request.method).toBe('POST');
    expect(request.headers['x-acme-signature']).toBe('abc123');
    expect(request.query).toEqual({ source: 'acme' });
    expect(toText(request.rawBody)).toBe(sent);
    expect(request.body).toEqual({ orderCode: 'A-1', note: 'café' });
  });

  it('Parses a body with a media type ending in +json', async () => {
    await sendWebhook('warehouse/eu', {
      method: 'POST',
      headers: { 'content-type': 'application/vnd.acme.v2+json' },
      body: '{"orderCode":"A-2"}',
    });

    expect(warehouse.webhookRequests[0].body).toEqual({ orderCode: 'A-2' });
  });

  it.each([
    ['a plain text body', 'text/plain', 'challenge-123'],
    [
      'a JSON-looking body with a text content type',
      'text/plain',
      '{"orderCode":"A-3"}',
    ],
    ['a form-encoded body', 'application/x-www-form-urlencoded', 'a=1&b=2'],
    ['an invalid JSON body', 'application/json', '{"orderCode":'],
    ['an empty JSON body', 'application/json', ''],
  ])('Leaves body undefined for %s', async (_case, contentType, sent) => {
    await sendWebhook('warehouse/eu', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: sent,
    });

    expect(toText(warehouse.webhookRequests[0].rawBody)).toBe(sent);
    expect(warehouse.webhookRequests[0].body).toBeUndefined();
  });

  it('Passes an empty rawBody for a request without a body', async () => {
    await sendWebhook('warehouse/eu?challenge=abc&attempt=2');

    const [request] = warehouse.webhookRequests;
    expect(request.method).toBe('GET');
    expect(request.query).toEqual({ challenge: 'abc', attempt: '2' });
    expect(request.rawBody.byteLength).toBe(0);
    expect(request.body).toBeUndefined();
  });

  it('Passes the status, headers and JSON body of the strategy through', async () => {
    warehouse.respond = () => ({
      statusCode: 202,
      headers: { 'x-trace-id': 'trace-1' },
      body: { accepted: true },
    });

    const response = await sendWebhook('warehouse/eu', { method: 'POST' });

    expect(response.status).toBe(202);
    expect(response.headers.get('x-trace-id')).toBe('trace-1');
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=utf-8',
    );
    expect(await response.json()).toEqual({ accepted: true });
  });

  it('Sends a string body without a content type as text/plain', async () => {
    warehouse.respond = () => ({ statusCode: 200, body: 'challenge-123' });

    const response = await sendWebhook('warehouse/eu');

    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(await response.text()).toBe('challenge-123');
  });

  it('Keeps the content type the strategy sets for a string body', async () => {
    warehouse.respond = () => ({
      statusCode: 200,
      headers: { 'Content-Type': 'application/xml' },
      body: '<accepted/>',
    });

    const response = await sendWebhook('warehouse/eu');

    expect(response.headers.get('content-type')).toBe(
      'application/xml; charset=utf-8',
    );
    expect(await response.text()).toBe('<accepted/>');
  });

  it('Sends a Uint8Array body as application/octet-stream', async () => {
    warehouse.respond = () => ({
      statusCode: 200,
      body: Uint8Array.from([1, 2, 3]),
    });

    const response = await sendWebhook('warehouse/eu');

    expect(response.headers.get('content-type')).toBe(
      'application/octet-stream',
    );
    expect(toHex(new Uint8Array(await response.arrayBuffer()))).toBe('010203');
  });

  it('Answers 500 with an empty body and logs the error when the strategy throws', async () => {
    warehouse.respond = () => {
      throw new Error('Simulated webhook failure');
    };

    const response = await sendWebhook('warehouse/eu', {
      method: 'POST',
      headers: { 'x-api-key': 'secret-key-123' },
      body: 'secret-body-456',
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('');
    const errors = recordingLogger.errors.filter((entry) =>
      entry.message.startsWith('Webhook POST'),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].context).toBe('OrderIntegrationPlugin');
    expect(errors[0].message).toBe(
      `Webhook POST for strategy 'warehouse' (connection "eu") failed: Simulated webhook failure`,
    );
    expect(errors[0].trace).toContain('Error: Simulated webhook failure');
    // Neither headers nor body are logged
    expect(JSON.stringify(errors)).not.toContain('secret-key-123');
    expect(JSON.stringify(errors)).not.toContain('secret-body-456');
  });

  it('Creates no job for handled, rejected or failed webhooks', async () => {
    await waitForAllJobsSettled();
    const jobsBefore = (await getJobs()).length;

    await sendWebhook('warehouse/eu', { method: 'POST', body: '{}' });
    warehouse.respond = () => ({ statusCode: 503 });
    await sendWebhook('warehouse/eu', { method: 'POST', body: '{}' });
    warehouse.respond = () => {
      throw new Error('Simulated webhook failure');
    };
    await sendWebhook('warehouse/eu', { method: 'POST', body: '{}' });

    expect(warehouse.webhookRequests).toHaveLength(3);
    expect(await getJobs()).toHaveLength(jobsBefore);
  });
});

describe('Signed webhooks of a provider with two connections', () => {
  let euOrder: SettledOrder;
  let usOrder: SettledOrder;
  let jobsBefore: number;
  let euRequestsBefore: number;

  beforeAll(async () => {
    // The channels eu and us were created by the channel eligibility test
    euOrder = await createSettledOrderInChannel('eu');
    usOrder = await createSettledOrderInChannel('us');
    await waitFor(() => acme.clients.eu.requestsForOrder(euOrder.code)[0]);
    await waitForAllJobsSettled();
    jobsBefore = (await getJobs()).length;
    euRequestsBefore = acme.clients.eu.requests.length;
  });

  it.each([
    { name: 'a missing signature', signatureOf: () => undefined },
    { name: 'a signature of the wrong length', signatureOf: () => 'deadbeef' },
    {
      name: 'a signature made with another secret',
      signatureOf: (body: string) => sign('other-secret', body),
    },
  ])(
    'Rejects $name with 401 and leaves the order unchanged',
    async ({ signatureOf }) => {
      const body = JSON.stringify({ orderCode: euOrder.code });

      const response = await postJson('acme/eu', body, signatureOf(body));

      expect(response.status).toBe(401);
      expect(await getIntegrationStatus(euOrder.id)).toBeNull();
    },
  );

  it('Rejects a webhook for connection eu that references an order of connection us with 403', async () => {
    const body = JSON.stringify({ orderCode: usOrder.code });

    const response = await postJson(
      'acme/eu',
      body,
      sign('eu-signing-secret', body),
    );

    expect(response.status).toBe(403);
    expect(await getIntegrationStatus(usOrder.id)).toBeNull();
  });

  it('Creates no job for the rejected webhooks', async () => {
    expect(await getJobs()).toHaveLength(jobsBefore);
  });

  it('Updates only the order of the connection for a correctly signed webhook', async () => {
    // Pretty-printed on purpose: only a check over the exact bytes sent matches this signature
    const body = JSON.stringify({ orderCode: euOrder.code }, null, 2);

    const response = await postJson(
      'acme/eu',
      body,
      sign('eu-signing-secret', body),
    );

    expect(response.status).toBe(200);
    expect(await getIntegrationStatus(euOrder.id)).toBe('shipped');
    expect(await getIntegrationStatus(usOrder.id)).toBeNull();
  });

  it('Recognises its own update in onOrderUpdated and makes no outbound call', async () => {
    const euOrderId = toEntityId(euOrder.id);
    const job = await waitForJob(
      'acme',
      'onOrderUpdated',
      euOrderId,
      'COMPLETED',
    );
    await waitForAllJobsSettled();

    expect(await findJobs('acme', euOrderId, 'onOrderUpdated')).toHaveLength(1);
    expect(job.result).toMatchObject({
      strategyName: 'acme',
      hook: 'onOrderUpdated',
      orderIds: [euOrderId],
    });
    const [update] = acme.invocationsFor(euOrderId, 'onOrderUpdated');
    expect(update.channelToken).toBe('eu');
    expect(update.event.input).toEqual({
      customFields: { integrationStatus: 'shipped' },
    });
    // The guard skipped the update, so the eu client got no new request
    expect(acme.clients.eu.requests).toHaveLength(euRequestsBefore);
    expect(acme.clients.us.requestsForOrder(euOrder.code)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Order and ids as the Admin API returns them after a mutation. */
interface ModifiedOrder {
  id: string;
  state: string;
  lines: { id: string; productVariant: { id: string } }[];
  payments: { id: string; state: string }[];
}

/** A job of the `order-integration` queue, as the Admin API `jobs` query returns it. */
interface JobRecord {
  state: string;
  isSettled: boolean;
  attempts: number;
  error: string | null;
  result: Record<string, unknown> | null;
  data: {
    strategyName: string;
    hook: HookName;
    event: { eventId: string; orderIds: number[] };
  };
}

/** Decodes an API id such as 'T_5' to the numeric id found in events and job data. */
function toEntityId(apiId: ID): number {
  return Number(String(apiId).replace('T_', ''));
}

/** The API id of the line of `variantId`, such as 'T_3'. */
function lineIdFor(
  order: {
    lines: { id: ID; productVariant: { id: ID } }[];
  },
  variantId: string,
): string {
  const line = order.lines.find(
    (candidate) => String(candidate.productVariant.id) === variantId,
  );
  if (!line) {
    throw new Error(`The order has no line for ${variantId}`);
  }
  return String(line.id);
}

/** Runs a mutation and returns its result, or fails the test when it is an ErrorResult. */
async function mutate<T extends object = Record<string, unknown>>(
  client: SimpleGraphQLClient,
  document: DocumentNode,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await client.query<
    Record<string, T & { errorCode?: string; message?: string }>
  >(document, variables);
  const result = Object.values(response)[0];
  if (result.errorCode) {
    throw new Error(`${result.errorCode}: ${result.message}`);
  }
  return result;
}

/**
 * Refunds an amount of a payment with the reason 'Customer request'. Vendure 3.7 still
 * needs the deprecated `shipping` and `adjustment` inputs: without them the insert of
 * the refund fails on its NOT NULL columns.
 */
function refundPayment(
  paymentId: string,
  amount: number,
): Promise<{ id: string }> {
  return mutate(adminClient, REFUND_ORDER, {
    input: {
      paymentId,
      amount,
      reason: 'Customer request',
      shipping: 0,
      adjustment: 0,
    },
  });
}

/** The id of the payment made at checkout. */
function firstPaymentId(order: SettledOrder): string {
  const payment = order.payments?.[0];
  if (!payment) {
    throw new Error(`Order ${order.code} has no payment`);
  }
  return payment.id;
}

async function loginAsCustomer(): Promise<void> {
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
}

/** Places the active order of the logged in customer, paying with the test payment method. */
async function checkout(): Promise<SettledOrder> {
  const transition = await proceedToArrangingPayment(shopClient, 1, {
    input: {
      fullName: 'Martinho Pinelabio',
      streetLine1: 'Verzetsstraat',
      streetLine2: '12a',
      city: 'Liwwa',
      postalCode: '8923CP',
      countryCode: 'NL',
    },
  });
  if (transition && 'errorCode' in transition) {
    throw new Error(`Could not arrange payment: ${transition.message}`);
  }
  const order = await addPaymentToOrder(shopClient, 'test-payment-method');
  if ('errorCode' in order) {
    throw new Error(`Could not pay: ${order.message}`);
  }
  return order;
}

/** An active cart with 1 x T_1 and 2 x T_2. */
async function createCartWithTwoLines() {
  await loginAsCustomer();
  await addItem(shopClient, 'T_1', 1);
  return addItem(shopClient, 'T_2', 2);
}

/** Publishes the `deleted` event of a line, which Vendure does not emit for placed orders. */
async function publishDeletedLineEvent(
  orderId: number,
  lineId: number,
): Promise<void> {
  const order = await server.app.get(OrderService).findOne(ctx, orderId);
  const line = order?.lines.find((candidate) => candidate.id === lineId);
  if (!order || !line) {
    throw new Error(`Order ${orderId} has no line ${lineId}`);
  }
  await server.app
    .get(EventBus)
    .publish(new OrderLineEvent(ctx, order, new OrderLine(line), 'deleted'));
}

/** Creates the channels `eu` and `us` and gives them the catalog and checkout setup of the default channel. */
async function createChannelsEuAndUs(): Promise<void> {
  const channelIds: number[] = [];
  for (const [token, currencyCode] of [
    ['eu', 'EUR'],
    ['us', 'USD'],
  ]) {
    const channel = await mutate<{ id: string }>(adminClient, CREATE_CHANNEL, {
      input: {
        code: token,
        token,
        defaultLanguageCode: 'en',
        pricesIncludeTax: true,
        defaultCurrencyCode: currencyCode,
        defaultTaxZoneId: 'T_1',
        defaultShippingZoneId: 'T_1',
        sellerId: 'T_1',
      },
    });
    channelIds.push(toEntityId(channel.id));
  }
  const channelService = server.app.get(ChannelService);
  await channelService.assignToChannels(ctx, StockLocation, 1, channelIds);
  for (const channelId of channelIds) {
    await server.app
      .get(ProductVariantService)
      .assignProductVariantsToChannel(ctx, {
        channelId,
        productVariantIds: [1],
      });
  }
  await channelService.assignToChannels(ctx, Product, 1, channelIds);
  await channelService.assignToChannels(ctx, PaymentMethod, 1, channelIds);
  await channelService.assignToChannels(ctx, ShippingMethod, 1, channelIds);
}

/** Places an order for 1 x T_1 in the channel with the given token. */
async function createSettledOrderInChannel(
  channelToken: string,
): Promise<SettledOrder> {
  shopClient.setChannelToken(channelToken);
  try {
    return await createSettledOrder(shopClient, 1, true, [
      { id: 'T_1', quantity: 1 },
    ]);
  } finally {
    shopClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
  }
}

async function reloadOrder(orderId: string) {
  const order = await getOrder(adminClient, orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  return order;
}

/** The hooks a strategy received for an order. */
function hooksOf(
  strategy: { invocationsFor(orderId: ID): RecordedInvocation[] },
  orderId: number,
): HookName[] {
  return strategy.invocationsFor(orderId).map((invocation) => invocation.hook);
}

/** The order transitions a strategy received for an order, such as 'ArrangingPayment -> PaymentSettled'. */
function transitionsOf(strategy: WarehouseStrategy, orderId: number): string[] {
  return strategy
    .invocationsFor(orderId, 'onOrderStateTransition')
    .map((invocation) => {
      const { fromState, toState } = invocation.event.data as {
        fromState: string;
        toState: string;
      };
      return `${fromState} -> ${toState}`;
    });
}

function summarize(invocations: RecordedInvocation[]) {
  return invocations.map(({ hook, channelToken, languageCode }) => ({
    hook,
    channelToken,
    languageCode,
  }));
}

function lineDataOf(invocation: RecordedInvocation): OrderLineEventData {
  return invocation.event.data as OrderLineEventData;
}

/** Asserts that both lists hold the same members, whatever their order: hooks have no ordering guarantee. */
function expectSameMembers<T>(actual: T[], expected: T[]): void {
  expect(actual).toHaveLength(expected.length);
  expect(actual).toEqual(expect.arrayContaining(expected));
}

async function getJobs(): Promise<JobRecord[]> {
  const { jobs } = await adminClient.query<{ jobs: { items: JobRecord[] } }>(
    GET_JOBS,
    { options: { filter: { queueName: { eq: 'order-integration' } } } },
  );
  return jobs.items;
}

/** The jobs of a strategy for an order, optionally of one hook. */
async function findJobs(
  strategyName: string,
  orderId: number,
  hook?: HookName,
): Promise<JobRecord[]> {
  return (await getJobs()).filter(
    (job) =>
      job.data.strategyName === strategyName &&
      job.data.event.orderIds.includes(orderId) &&
      (hook === undefined || job.data.hook === hook),
  );
}

/** Waits until a job of the strategy and hook for the order is in the given state. */
async function waitForJob(
  strategyName: string,
  hook: HookName,
  orderId: number,
  state: string,
): Promise<JobRecord> {
  return waitFor(
    async () =>
      (await findJobs(strategyName, orderId, hook)).find(
        (job) => job.state === state,
      ),
    100,
    20000,
  );
}

/** Waits until every job of the queue has completed or failed, so absences can be asserted. */
async function waitForAllJobsSettled(): Promise<void> {
  await waitFor(
    async () => (await getJobs()).every((job) => job.isSettled),
    100,
    30000,
  );
}

/** Sends a request to the webhook endpoint with Node's fetch: no admin token, no default headers. */
function sendWebhook(path: string, init?: RequestInit): Promise<Response> {
  return fetch(
    `http://localhost:${testConfig.apiOptions.port}/order-integration/${path}`,
    init,
  );
}

/** Posts a JSON body, optionally with a signature header. */
function postJson(
  path: string,
  body: string,
  signature?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (signature) {
    headers['x-acme-signature'] = signature;
  }
  return sendWebhook(path, { method: 'POST', headers, body });
}

/** Hex HMAC-SHA256 of the body, the way the simulated acme provider signs its webhooks. */
function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function toText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf-8');
}

/** The `integrationStatus` custom field of an order, or null when it is unset. */
async function getIntegrationStatus(orderId: string): Promise<string | null> {
  const { order } = await adminClient.query<{
    order: { customFields: { integrationStatus: string | null } };
  }>(GET_ORDER_STATUS, { id: orderId });
  return order.customFields.integrationStatus;
}

// ---------------------------------------------------------------------------
// GraphQL documents
// ---------------------------------------------------------------------------

const GET_JOBS = gql`
  query GetJobs($options: JobListOptions) {
    jobs(options: $options) {
      items {
        state
        isSettled
        attempts
        error
        result
        data
      }
    }
  }
`;

const CREATE_CHANNEL = gql`
  mutation CreateChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
      ... on Channel {
        id
        token
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const SET_ORDER_CUSTOM_FIELDS = gql`
  mutation SetOrderCustomFields($input: UpdateOrderInput!) {
    setOrderCustomFields(input: $input) {
      id
    }
  }
`;

const ADJUST_ORDER_LINE = gql`
  mutation AdjustOrderLine($orderLineId: ID!, $quantity: Int!) {
    adjustOrderLine(orderLineId: $orderLineId, quantity: $quantity) {
      ... on Order {
        id
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const REMOVE_ORDER_LINE = gql`
  mutation RemoveOrderLine($orderLineId: ID!) {
    removeOrderLine(orderLineId: $orderLineId) {
      ... on Order {
        id
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const TRANSITION_ORDER_TO_STATE = gql`
  mutation TransitionOrderToState($id: ID!, $state: String!) {
    transitionOrderToState(id: $id, state: $state) {
      ... on Order {
        id
        state
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const MODIFY_ORDER = gql`
  mutation ModifyOrder($input: ModifyOrderInput!) {
    modifyOrder(input: $input) {
      ... on Order {
        id
        state
        lines {
          id
          productVariant {
            id
          }
        }
        payments {
          id
          state
        }
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const ADD_MANUAL_PAYMENT = gql`
  mutation AddManualPaymentToOrder($input: ManualPaymentInput!) {
    addManualPaymentToOrder(input: $input) {
      ... on Order {
        id
        state
        lines {
          id
          productVariant {
            id
          }
        }
        payments {
          id
          state
        }
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const SETTLE_PAYMENT = gql`
  mutation SettlePayment($id: ID!) {
    settlePayment(id: $id) {
      ... on Payment {
        id
        state
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const REFUND_ORDER = gql`
  mutation RefundOrder($input: RefundOrderInput!) {
    refundOrder(input: $input) {
      ... on Refund {
        id
        state
        total
        reason
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const SETTLE_REFUND = gql`
  mutation SettleRefund($input: SettleRefundInput!) {
    settleRefund(input: $input) {
      ... on Refund {
        id
        state
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const TRANSITION_FULFILLMENT_TO_STATE = gql`
  mutation TransitionFulfillmentToState($id: ID!, $state: String!) {
    transitionFulfillmentToState(id: $id, state: $state) {
      ... on Fulfillment {
        id
        state
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const GET_ORDER_STATUS = gql`
  query GetOrderIntegrationStatus($id: ID!) {
    order(id: $id) {
      id
      customFields {
        integrationStatus
      }
    }
  }
`;
