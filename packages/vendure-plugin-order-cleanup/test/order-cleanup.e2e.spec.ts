import { ModuleRef } from '@nestjs/core';
import { rmSync } from 'node:fs';
import {
  Channel,
  ConfigService,
  DefaultLogger,
  EventBus,
  ID,
  Injector,
  isGraphQlErrorResult,
  Logger,
  LogLevel,
  mergeConfig,
  Order,
  OrderInterceptor,
  OrderLineEvent,
  OrderService,
  ProductVariant,
  RequestContext,
  RequestContextService,
  TransactionalConnection,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import {
  createOrderCleanupTask,
  DEFAULT_ORDER_CLEANUP_OPTIONS,
  normalizeOrderCleanupOptions,
  OrderCleanupPlugin,
} from '../src/order-cleanup.plugin';
import { OrderCleanupService } from '../src/service/order-cleanup.service';
import {
  getNextPageSize,
  isCronDue,
  ORDER_CLEANUP_PROCESSING_LIMIT,
  resolveOrderCleanupChannel,
  toBatches,
} from '../src/service/util';

let server: TestServer;
let ctx: RequestContext;
let connection: TransactionalConnection;
let orderService: OrderService;
let cleanupService: OrderCleanupService;
let requestContextService: RequestContextService;
let eventBus: EventBus;
let testVariantIds: ID[];
let rejectedOrderId: ID | undefined;
let rejectionAttempts = 0;
const testDatabasePath = `/tmp/pinelab-order-cleanup-v2-${process.pid}`;

const rejectionInterceptor: OrderInterceptor = {
  willRemoveItemFromOrder(_ctx, order) {
    if (
      rejectedOrderId != null &&
      String(order.id) === String(rejectedOrderId)
    ) {
      rejectionAttempts++;
      return 'Injected removal failure';
    }
  },
};

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer(testDatabasePath));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    orderOptions: {
      orderInterceptors: [rejectionInterceptor],
    },
    plugins: [
      OrderCleanupPlugin.init({
        olderThanDays: 1,
        batchSize: 1,
        schedule: {
          cron: '* * * * *',
          timezone: 'UTC',
          timeout: '5m',
        },
      }),
    ],
  });

  ({ server } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
    customerCount: 2,
  });
  requestContextService = server.app.get(RequestContextService);
  ctx = await requestContextService.create({
    apiType: 'admin',
  });
  connection = server.app.get(TransactionalConnection);
  orderService = server.app.get(OrderService);
  cleanupService = server.app.get(OrderCleanupService);
  eventBus = server.app.get(EventBus);
  testVariantIds = (
    await connection.getRepository(ctx, ProductVariant).find({ take: 2 })
  ).map((variant) => variant.id);
  if (testVariantIds.length < 2) {
    throw new Error(
      `Expected at least two product variants, found ${testVariantIds.length}`
    );
  }
}, 60000);

afterAll(async () => {
  try {
    await server?.destroy();
  } finally {
    rmSync(testDatabasePath, { recursive: true, force: true });
  }
}, 100000);

/** Create an order with the requested variants and persisted state. */
async function createOrder(
  state: Order['state'] = 'AddingItems',
  productVariantIds: ID[] = testVariantIds.slice(0, 1)
): Promise<ID> {
  let order = await orderService.create(ctx);
  for (const productVariantId of productVariantIds) {
    const result = await orderService.addItemToOrder(
      ctx,
      order.id,
      productVariantId,
      1
    );
    if (isGraphQlErrorResult(result)) {
      throw new Error(result.message);
    }
    order = result;
  }
  if (state !== order.state) {
    await connection.getRepository(ctx, Order).update(order.id, { state });
  }
  return order.id;
}

/** Move an order timestamp behind the configured age cutoff. */
async function makeStale(orderId: ID): Promise<void> {
  await setUpdatedAt(orderId, new Date('2020-01-01T00:00:00.000Z'));
}

/** Set updatedAt without triggering TypeORM's automatic update timestamp. */
async function setUpdatedAt(orderId: ID, updatedAt: Date): Promise<void> {
  const repository = connection.getRepository(ctx, Order);
  const driver = connection.rawConnection.driver;
  const table = driver.escape(repository.metadata.tablePath);
  const updatedAtColumn = driver.escape(
    repository.metadata.findColumnWithPropertyName('updatedAt')!.databaseName
  );
  const idColumn = driver.escape(
    repository.metadata.findColumnWithPropertyName('id')!.databaseName
  );
  await connection.rawConnection.query(
    `UPDATE ${table} SET ${updatedAtColumn} = ? WHERE ${idColumn} = ?`,
    [updatedAt.toISOString(), orderId]
  );
}

/** Load an order with its default relations. */
async function getOrder(orderId: ID): Promise<Order> {
  const order = await orderService.findOne(ctx, orderId);
  if (!order) {
    throw new Error(`Order ${orderId} was not found`);
  }
  return order;
}

describe('schedule configuration', () => {
  it('applies documented defaults', () => {
    const options = normalizeOrderCleanupOptions({ olderThanDays: 30 });
    expect(options).toEqual(DEFAULT_ORDER_CLEANUP_OPTIONS);
  });

  it('rejects invalid option values', () => {
    expect(() => normalizeOrderCleanupOptions({ olderThanDays: -1 })).toThrow(
      /olderThanDays/
    );
    expect(() =>
      normalizeOrderCleanupOptions({ olderThanDays: 1, batchSize: 0 })
    ).toThrow(/batchSize/);
    expect(() =>
      normalizeOrderCleanupOptions({
        olderThanDays: 1,
        schedule: { cron: '* * * * * *' },
      })
    ).toThrow(/five-field/);
    expect(() =>
      normalizeOrderCleanupOptions({
        olderThanDays: 1,
        schedule: { timezone: 'Not/A_Timezone' },
      })
    ).toThrow(/IANA timezone/);
  });

  it('evaluates the default Amsterdam time in winter and summer', () => {
    expect(
      isCronDue(
        '0 3 * * *',
        'Europe/Amsterdam',
        new Date('2026-01-15T02:00:37Z')
      )
    ).toBe(true);
    expect(
      isCronDue(
        '0 3 * * *',
        'Europe/Amsterdam',
        new Date('2026-07-15T01:00:37Z')
      )
    ).toBe(true);
    expect(
      isCronDue(
        '0 3 * * *',
        'Europe/Amsterdam',
        new Date('2026-07-15T02:00:00Z')
      )
    ).toBe(false);
  });

  it('evaluates custom timezone schedules across a daylight-saving boundary', () => {
    expect(
      isCronDue(
        '0 3 * * *',
        'America/New_York',
        new Date('2026-03-07T08:00:00Z')
      )
    ).toBe(true);
    expect(
      isCronDue(
        '0 3 * * *',
        'America/New_York',
        new Date('2026-03-09T07:00:00Z')
      )
    ).toBe(true);
  });

  it('creates a protected minute-level Vendure task with effective params', () => {
    const options = normalizeOrderCleanupOptions({ olderThanDays: 30 });
    const task = createOrderCleanupTask(options);
    expect(task.options.schedule).toBe('* * * * *');
    expect(task.options.preventOverlap).toBe(true);
    expect(task.options.timeout).toBe('1h');
    expect(task.options.params).toEqual(options);
  });

  it('registers the cleanup task with custom plugin options', () => {
    const tasks = server.app.get(ConfigService).schedulerOptions.tasks ?? [];
    const task = tasks.find((candidate) => candidate.id === 'order-cleanup');
    expect(task?.options.schedule).toBe('* * * * *');
    expect(task?.options.timeout).toBe('5m');
    expect(task?.options.params).toMatchObject({
      olderThanDays: 1,
      batchSize: 1,
      schedule: { cron: '* * * * *', timezone: 'UTC' },
    });
  });

  it('skips a non-matching tick without invoking cleanup', async () => {
    const nonMatchingMinute = (new Date().getUTCMinutes() + 1) % 60;
    const task = createOrderCleanupTask(
      normalizeOrderCleanupOptions({
        olderThanDays: 1,
        schedule: {
          cron: `${nonMatchingMinute} * * * *`,
          timezone: 'UTC',
        },
      })
    );
    const cleanupSpy = vi.spyOn(cleanupService, 'emptyStaleOrders');
    const result = (await task.execute(
      new Injector(server.app.get(ModuleRef))
    )) as { scheduleSkipped: boolean };

    expect(result.scheduleSkipped).toBe(true);
    expect(cleanupSpy).not.toHaveBeenCalled();
    cleanupSpy.mockRestore();
  });
});

describe('batch and processing bounds', () => {
  it('partitions work by configured batch size', () => {
    expect(toBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('does not allow a page beyond the 10,000-order limit', () => {
    expect(getNextPageSize(0)).toBe(1000);
    expect(getNextPageSize(ORDER_CLEANUP_PROCESSING_LIMIT - 1)).toBe(1);
    expect(getNextPageSize(ORDER_CLEANUP_PROCESSING_LIMIT)).toBe(0);
  });

  it('stops the service at exactly 10,000 attempts and logs deferred work', async () => {
    const service = cleanupService as unknown as {
      findCandidates: (...args: unknown[]) => Promise<Order[]>;
      emptyOrder: (...args: unknown[]) => Promise<'emptied'>;
    };
    let nextId = 1;
    const findSpy = vi
      .spyOn(service, 'findCandidates')
      .mockImplementation(async (...args) => {
        const take = args[3] as number;
        return Array.from({ length: take }, () => ({
          id: nextId++,
          updatedAt: new Date('2020-01-01T00:00:00.000Z'),
        })) as Order[];
      });
    const emptySpy = vi
      .spyOn(service, 'emptyOrder')
      .mockResolvedValue('emptied');
    const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});

    const result = await cleanupService.emptyStaleOrders(ctx, 1, 1000);

    expect(result).toMatchObject({
      processed: ORDER_CLEANUP_PROCESSING_LIMIT,
      emptied: ORDER_CLEANUP_PROCESSING_LIMIT,
      failed: 0,
      skipped: 0,
      reachedProcessingLimit: true,
    });
    expect(findSpy).toHaveBeenCalledTimes(10);
    expect(emptySpy).toHaveBeenCalledTimes(ORDER_CLEANUP_PROCESSING_LIMIT);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('next run'),
      expect.any(String)
    );
    findSpy.mockRestore();
    emptySpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('order channel resolution', () => {
  const defaultChannel = { id: 1, code: '__default_channel__' } as Channel;
  const salesChannel = { id: 2, code: 'sales' } as Channel;

  it('uses the default channel for a default-only order', () => {
    expect(resolveOrderCleanupChannel([defaultChannel], defaultChannel)).toBe(
      defaultChannel
    );
  });

  it('uses the single non-default sales channel', () => {
    expect(
      resolveOrderCleanupChannel([defaultChannel, salesChannel], defaultChannel)
    ).toBe(salesChannel);
  });

  it('rejects an order assigned to multiple non-default channels', () => {
    const secondSalesChannel = { id: 3, code: 'other-sales' } as Channel;
    expect(() =>
      resolveOrderCleanupChannel(
        [defaultChannel, salesChannel, secondSalesChannel],
        defaultChannel
      )
    ).toThrow(/multiple non-default channels: 2, 3/);
  });
});

describe('stale order cleanup', () => {
  it('uses the selected channel default language for cleanup', async () => {
    const orderId = await createOrder('AddingItems');
    await makeStale(orderId);
    const createContextSpy = vi.spyOn(requestContextService, 'create');

    await cleanupService.emptyStaleOrders(ctx);

    expect(createContextSpy).toHaveBeenCalledTimes(1);
    const contextOptions = createContextSpy.mock.calls[0][0];
    expect(contextOptions).toMatchObject({
      apiType: 'admin',
      channelOrToken: expect.anything(),
    });
    expect(contextOptions).not.toHaveProperty('languageCode');
    const orderContext = await createContextSpy.mock.results[0].value;
    expect(orderContext.channelId).toBe(
      (contextOptions.channelOrToken as Channel).id
    );
    expect(orderContext.languageCode).toBe(
      orderContext.channel.defaultLanguageCode
    );
    createContextSpy.mockRestore();
  });

  it('empties eligible stale orders and preserves their states', async () => {
    const addingItemsId = await createOrder('AddingItems', testVariantIds);
    const createdId = await createOrder('Created');
    const arrangingPaymentId = await createOrder('ArrangingPayment');
    const ineligibleId = await createOrder('Cancelled');
    const recentId = await createOrder('AddingItems');
    const emptyId = (await orderService.create(ctx)).id;

    await Promise.all(
      [addingItemsId, createdId, arrangingPaymentId, ineligibleId, emptyId].map(
        makeStale
      )
    );
    expect((await getOrder(addingItemsId)).updatedAt.getUTCFullYear()).toBe(
      2020
    );
    expect((await getOrder(addingItemsId)).lines).toHaveLength(2);

    const result = await cleanupService.emptyStaleOrders(ctx);
    expect(result).toMatchObject({
      processed: 3,
      emptied: 3,
      failed: 0,
      skipped: 0,
      reachedProcessingLimit: false,
    });

    for (const [id, state] of [
      [addingItemsId, 'AddingItems'],
      [createdId, 'Created'],
      [arrangingPaymentId, 'ArrangingPayment'],
    ] as const) {
      const order = await getOrder(id);
      expect(order.lines).toHaveLength(0);
      expect(order.state).toBe(state);
    }
    expect((await getOrder(ineligibleId)).lines).toHaveLength(1);
    expect((await getOrder(recentId)).lines).toHaveLength(1);
    expect((await getOrder(emptyId)).lines).toHaveLength(0);

    const secondRun = await cleanupService.emptyStaleOrders(ctx);
    expect(secondRun.processed).toBe(0);
  });

  it('publishes a deleted event for every removed order line', async () => {
    const orderId = await createOrder('AddingItems', testVariantIds);
    await makeStale(orderId);
    const lineIds = (await getOrder(orderId)).lines.map(({ id }) => String(id));
    const publishSpy = vi.spyOn(eventBus, 'publish');

    await cleanupService.emptyStaleOrders(ctx);

    const deletionEvents = publishSpy.mock.calls
      .map(([event]) => event)
      .filter(
        (event): event is OrderLineEvent => event instanceof OrderLineEvent
      );
    expect(deletionEvents).toHaveLength(lineIds.length);
    expect(deletionEvents.map(({ orderLine }) => String(orderLine.id))).toEqual(
      expect.arrayContaining(lineIds)
    );
    expect(deletionEvents.every(({ type }) => type === 'deleted')).toBe(true);
    publishSpy.mockRestore();
  });

  it('does not empty stale orders in any other default Vendure state', async () => {
    const ineligibleStates: Order['state'][] = [
      'Draft',
      'Cancelled',
      'PaymentAuthorized',
      'PaymentSettled',
      'PartiallyShipped',
      'Shipped',
      'PartiallyDelivered',
      'Delivered',
      'Modifying',
      'ArrangingAdditionalPayment',
    ];
    const ineligibleOrders: Array<{ id: ID; state: Order['state'] }> = [];
    for (const state of ineligibleStates) {
      ineligibleOrders.push({ id: await createOrder(state), state });
    }
    await Promise.all(ineligibleOrders.map(({ id }) => makeStale(id)));

    const result = await cleanupService.emptyStaleOrders(ctx);

    expect(result.processed).toBe(0);
    for (const { id, state } of ineligibleOrders) {
      const order = await getOrder(id);
      expect(order.state).toBe(state);
      expect(order.lines).toHaveLength(1);
    }
  });

  it('logs one failure, attempts it once, and continues with later orders', async () => {
    rejectedOrderId = await createOrder('AddingItems');
    const successfulOrderId = await createOrder('AddingItems');
    await makeStale(rejectedOrderId);
    await makeStale(successfulOrderId);
    rejectionAttempts = 0;

    const result = await cleanupService.emptyStaleOrders(ctx);
    expect(result).toMatchObject({ processed: 2, emptied: 1, failed: 1 });
    expect(rejectionAttempts).toBe(1);
    expect((await getOrder(rejectedOrderId)).lines).toHaveLength(1);
    expect((await getOrder(successfulOrderId)).lines).toHaveLength(0);
    rejectedOrderId = undefined;
    await cleanupService.emptyStaleOrders(ctx);
  });

  it('rolls back line removal when price recalculation fails', async () => {
    const orderId = await createOrder('AddingItems');
    await makeStale(orderId);
    const adjustmentSpy = vi
      .spyOn(orderService, 'applyPriceAdjustments')
      .mockRejectedValueOnce(new Error('Injected recalculation failure'));

    const result = await cleanupService.emptyStaleOrders(ctx);

    expect(result).toMatchObject({ processed: 1, emptied: 0, failed: 1 });
    expect((await getOrder(orderId)).lines).toHaveLength(1);
    adjustmentSpy.mockRestore();
    await cleanupService.emptyStaleOrders(ctx);
  });

  it('rolls back line removal when recalculation changes the order state', async () => {
    const orderId = await createOrder('AddingItems');
    await makeStale(orderId);
    const originalApplyPriceAdjustments =
      orderService.applyPriceAdjustments.bind(orderService);
    const adjustmentSpy = vi
      .spyOn(orderService, 'applyPriceAdjustments')
      .mockImplementationOnce(async (...args) => {
        const order = await originalApplyPriceAdjustments(...args);
        order.state = 'Created';
        return order;
      });

    const result = await cleanupService.emptyStaleOrders(ctx);

    expect(result).toMatchObject({ processed: 1, emptied: 0, failed: 1 });
    const unchangedOrder = await getOrder(orderId);
    expect(unchangedOrder.lines).toHaveLength(1);
    expect(unchangedOrder.state).toBe('AddingItems');
    adjustmentSpy.mockRestore();
  });

  it('revalidates a selected order before mutation', async () => {
    await cleanupService.emptyStaleOrders(ctx);
    const orderId = await createOrder('AddingItems');
    await makeStale(orderId);

    const service = cleanupService as unknown as {
      findCandidates: (...args: unknown[]) => Promise<Order[]>;
    };
    const originalFindCandidates = service.findCandidates.bind(cleanupService);
    const findSpy = vi
      .spyOn(service, 'findCandidates')
      .mockImplementationOnce(async (...args) => {
        const candidates = await originalFindCandidates(...args);
        await setUpdatedAt(orderId, new Date());
        return candidates;
      });

    const result = await cleanupService.emptyStaleOrders(ctx);
    expect(result).toMatchObject({ processed: 1, emptied: 0, skipped: 1 });
    expect((await getOrder(orderId)).lines).toHaveLength(1);
    findSpy.mockRestore();
  });

  it('runs cleanup directly from the registered task', async () => {
    const orderId = await createOrder('AddingItems');
    await makeStale(orderId);
    const task = server.app
      .get(ConfigService)
      .schedulerOptions.tasks?.find(
        (candidate) => candidate.id === 'order-cleanup'
      );
    if (!task) {
      throw new Error('Order cleanup task is not registered');
    }

    const result = (await task.execute(
      new Injector(server.app.get(ModuleRef))
    )) as { scheduleSkipped: boolean; emptied: number };
    expect(result.scheduleSkipped).toBe(false);
    expect(result.emptied).toBeGreaterThanOrEqual(1);
    expect((await getOrder(orderId)).lines).toHaveLength(0);
  });

  it('does not expose the removed HTTP trigger', async () => {
    const response = await fetch('http://localhost:3050/order-cleanup/trigger');
    expect(response.status).toBe(404);
  });
});
