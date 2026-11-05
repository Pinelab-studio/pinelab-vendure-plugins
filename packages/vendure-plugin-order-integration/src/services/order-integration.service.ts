import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { notNullOrUndefined } from '@vendure/common/lib/shared-utils';
import {
  EventBus,
  Fulfillment,
  FulfillmentEvent,
  FulfillmentStateTransitionEvent,
  ID,
  Injector,
  Job,
  JobQueue,
  JobQueueService,
  Json,
  Logger,
  OrderEvent,
  OrderLine,
  OrderLineEvent,
  OrderPlacedEvent,
  OrderService,
  OrderStateTransitionEvent,
  PaymentStateTransitionEvent,
  RefundEvent,
  RefundStateTransitionEvent,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
  Type,
  VendureEvent,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import {
  DEFAULT_RETRIES,
  loggerCtx,
  PLUGIN_INIT_OPTIONS,
  QUEUE_NAME,
} from '../constants';
import {
  EnqueuePayload,
  HookData,
  HookName,
  HookResult,
  JsonObject,
  JsonValue,
  OrderIntegrationPluginOptions,
  OrderIntegrationRoute,
  OrderIntegrationStrategy,
} from '../types';
import {
  buildFulfillmentCreatedPayload,
  getOrderRefs,
  OrderRef,
  snapshotOrderLine,
  snapshotRefund,
  toJson,
  toOrderEventInput,
} from './capture';

/**
 * Payload of the shared dispatch pipeline used by the event subscribers and
 * {@link OrderIntegrationService.enqueue}.
 *
 * @internal
 */
export interface DispatchPayload<H extends HookName> {
  /** Ids of the referenced orders; never empty. */
  readonly orderIds: readonly [ID, ...ID[]];
  /** Codes of those orders, for log messages and readable job data only. */
  readonly orderCodes: readonly string[];
  readonly data: HookData<H>;
  readonly input?: JsonValue;
  /** When the source event occurred (`VendureEvent.createdAt`, or the call time for enqueue). */
  readonly occurredAt: Date;
  /** Limits dispatch to `route.strategyName` and delivers `route.connectionId` unchanged. */
  readonly route?: OrderIntegrationRoute;
}

/** The event as stored in job data: plain, mutable JSON that the hook receives unchanged. */
type JobEvent = {
  eventId: string;
  occurredAt: string;
  route: { strategyName: string; connectionId?: string };
  orderIds: [ID, ...ID[]];
  input?: Json;
  data: { [key: string]: Json };
};

/** Job data of the `order-integration` queue. Internal: not exported from the package. */
type OrderIntegrationJobData = {
  ctx: SerializedRequestContext;
  strategyName: string;
  hook: HookName;
  event: JobEvent;
  /** Readable order references for logs and the Dashboard Job Queue page. */
  orderCodes: string[];
};

/** A hook as the processor calls it: `dispatch` built the payload for exactly that hook. */
type HookRunner = (ctx: RequestContext, event: JobEvent) => HookResult;

/** What a Vendure event needs to be dispatched: its context and creation time. */
type SourceEvent = Pick<VendureEvent, 'createdAt'> & { ctx: RequestContext };

/** The `data` and `input` of one hook invocation. */
type PayloadParts<H extends HookName> = Pick<
  DispatchPayload<H>,
  'data' | 'input'
>;

/** The hook of each `OrderLineEvent` type. */
const LINE_EVENT_HOOKS = {
  created: 'onOrderLineCreated',
  updated: 'onOrderLineUpdated',
  deleted: 'onOrderLineDeleted',
  cancelled: 'onOrderLineCancelled',
} as const satisfies Record<OrderLineEvent['type'], HookName>;

/** Whether the strategy implements the hook. */
function hasHook(strategy: OrderIntegrationStrategy, hook: HookName): boolean {
  return typeof strategy[hook] === 'function';
}

/**
 * Owns the strategy registry, the `order-integration` job queue, the Vendure event
 * subscriptions and the programmatic enqueue helper.
 */
@Injectable()
export class OrderIntegrationService
  implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown
{
  private queue!: JobQueue<OrderIntegrationJobData>;

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: OrderIntegrationPluginOptions,
    private readonly moduleRef: ModuleRef,
    private readonly jobQueueService: JobQueueService,
    private readonly eventBus: EventBus,
    private readonly connection: TransactionalConnection,
    private readonly orderService: OrderService,
  ) {}

  /** Creates the `order-integration` job queue (both server and worker). */
  async onModuleInit(): Promise<void> {
    this.queue =
      await this.jobQueueService.createQueue<OrderIntegrationJobData>({
        name: QUEUE_NAME,
        process: (job) => this.process(job),
      });
  }

  /** Initialises every strategy, then subscribes to the Vendure events. */
  async onApplicationBootstrap(): Promise<void> {
    const injector = new Injector(this.moduleRef);
    for (const strategy of this.options.strategies) {
      await strategy.init?.(injector);
    }
    this.subscribeToEvents();
  }

  /** Calls every strategy's optional `destroy()`. */
  async onApplicationShutdown(): Promise<void> {
    for (const strategy of this.options.strategies) {
      await strategy.destroy?.();
    }
  }

  /** Returns the registered strategy with the given name. */
  getStrategy(name: string): OrderIntegrationStrategy | undefined {
    return this.options.strategies.find((strategy) => strategy.name === name);
  }

  /**
   * Strategies that implement `hook` and are enabled for `ctx`, optionally limited to
   * `route.strategyName`. A throwing `isEnabled` is logged and counts as disabled.
   */
  private async getEligibleStrategies(
    ctx: RequestContext,
    hook: HookName,
    route?: OrderIntegrationRoute,
  ): Promise<OrderIntegrationStrategy[]> {
    const candidates = this.options.strategies.filter(
      (strategy) =>
        hasHook(strategy, hook) &&
        (!route || strategy.name === route.strategyName),
    );
    const enabled = await Promise.all(
      candidates.map((strategy) => this.isEnabled(ctx, strategy)),
    );
    return candidates.filter((_, index) => enabled[index]);
  }

  /**
   * Builds one event (fresh `eventId`, the given `occurredAt`) and adds one job per
   * eligible strategy to the `order-integration` queue. Returns the created jobs.
   *
   * @internal
   */
  async dispatch<H extends HookName>(
    ctx: RequestContext,
    hook: H,
    payload: DispatchPayload<H>,
  ): Promise<Job[]> {
    const strategies = await this.getEligibleStrategies(
      ctx,
      hook,
      payload.route,
    );
    // One event id for all strategies, but a fresh event object and context per job
    const eventId = randomUUID();
    return Promise.all(
      strategies.map((strategy) =>
        this.queue.add(
          {
            ctx: ctx.serialize(),
            strategyName: strategy.name,
            hook,
            event: this.buildEvent(eventId, strategy, payload),
            orderCodes: [...payload.orderCodes],
          },
          { retries: this.options.retries ?? DEFAULT_RETRIES, ctx },
        ),
      ),
    );
  }

  /**
   * Enqueues `hook` for orders without a Vendure event or webhook, through the same
   * eligibility, serialization and retry pipeline. Orders not found in `ctx`'s channel
   * are skipped; with no order left, it returns `[]`. With a
   * `route`, only that strategy is considered and the event carries `route.connectionId`;
   * an unknown strategy, or one that lacks the hook, rejects.
   */
  async enqueue<H extends HookName>(
    ctx: RequestContext,
    hook: H,
    payload: EnqueuePayload<H>,
    route?: OrderIntegrationRoute,
  ): Promise<Job[]> {
    this.assertRouteTargetsHook(hook, route);
    const orders = await Promise.all(
      payload.orderIds.map((id) => this.orderService.findOne(ctx, id, [])),
    );
    const refs = getOrderRefs(orders.filter(notNullOrUndefined));
    if (!refs) {
      return [];
    }
    return this.dispatch(ctx, hook, {
      ...refs,
      data: payload.data,
      input: payload.input,
      occurredAt: new Date(),
      route,
    });
  }

  /** Rejects when `route` names an unknown strategy or one that lacks `hook`. */
  private assertRouteTargetsHook(
    hook: HookName,
    route?: OrderIntegrationRoute,
  ): void {
    if (!route) {
      return;
    }
    const strategy = this.getStrategy(route.strategyName);
    if (!strategy) {
      throw new Error(
        `Unknown order integration strategy '${route.strategyName}'`,
      );
    }
    if (!hasHook(strategy, hook)) {
      throw new Error(
        `Order integration strategy '${route.strategyName}' does not implement '${hook}'`,
      );
    }
  }

  /** A missing `isEnabled` means enabled; a throwing one is logged and means disabled. */
  private async isEnabled(
    ctx: RequestContext,
    strategy: OrderIntegrationStrategy,
  ): Promise<boolean> {
    if (!strategy.isEnabled) {
      return true;
    }
    try {
      return await strategy.isEnabled(ctx);
    } catch (e) {
      const error = asError(e);
      Logger.error(
        `isEnabled() of strategy '${strategy.name}' failed for channel '${ctx.channel.token}', so it is treated as disabled: ${error.message}`,
        loggerCtx,
        error.stack,
      );
      return false;
    }
  }

  /** The event of one job, as fresh plain JSON without Dates or shared references. */
  private buildEvent<H extends HookName>(
    eventId: string,
    strategy: OrderIntegrationStrategy,
    payload: DispatchPayload<H>,
  ): JobEvent {
    return toJson({
      eventId,
      occurredAt: payload.occurredAt.toISOString(),
      route: {
        strategyName: strategy.name,
        connectionId: payload.route?.connectionId,
      },
      orderIds: payload.orderIds,
      input: payload.input,
      data: payload.data,
    }) as JobEvent;
  }

  /**
   * Queue processor: runs the hook of the job's strategy. A failed attempt is logged and
   * rethrown, so the job queue retries it with the same job data.
   */
  private async process(job: Job<OrderIntegrationJobData>) {
    const { strategyName, hook, event, orderCodes } = job.data;
    try {
      await this.runHook(job.data);
      return {
        strategyName,
        hook,
        eventId: event.eventId,
        orderIds: event.orderIds,
      };
    } catch (e) {
      const error = asError(e);
      Logger.error(
        `Hook '${hook}' of strategy '${strategyName}' failed for order(s) ${orderCodes.join(', ')} (attempts: ${job.attempts}, retries: ${job.retries}): ${error.message}`,
        loggerCtx,
        error.stack,
      );
      // The DefaultJobQueuePlugin stores the error in a varchar(255) column on MySQL/MariaDB.
      // `Object.assign` because the package compiles against lib es2021, where Error has no `cause` option.
      throw Object.assign(new Error(error.message.slice(0, 255)), {
        cause: error,
      });
    }
  }

  /** Resolves the job's strategy and awaits its hook with the deserialized context. */
  private async runHook({
    ctx,
    strategyName,
    hook,
    event,
  }: OrderIntegrationJobData): Promise<void> {
    const strategy = this.getStrategy(strategyName);
    if (!strategy) {
      throw new Error(
        `Order integration strategy '${strategyName}' is not registered, was it removed from the configuration?`,
      );
    }
    if (!hasHook(strategy, hook)) {
      throw new Error(
        `Order integration strategy '${strategyName}' does not implement '${hook}'`,
      );
    }
    const run = strategy[hook] as unknown as HookRunner;
    await run.call(strategy, RequestContext.deserialize(ctx), event);
  }

  /** One subscription per Vendure event class that maps to a hook. */
  private subscribeToEvents(): void {
    // Orders and their lines
    this.listen(
      OrderPlacedEvent,
      (event) => this.captureOrderPlaced(event),
      (event) => `order ${event.order.code}`,
    );
    this.listen(
      OrderStateTransitionEvent,
      (event) => this.captureOrderStateTransition(event),
      (event) => `order ${event.order.code}`,
    );
    this.listen(
      OrderEvent,
      (event) => this.captureOrderEvent(event),
      (event) => `order ${event.entity.code}`,
    );
    this.listen(
      OrderLineEvent,
      (event) => this.captureOrderLine(event),
      (event) => `order ${event.order.code}`,
    );
    // Payments and refunds
    this.listen(
      PaymentStateTransitionEvent,
      (event) => this.capturePaymentStateTransition(event),
      (event) => `order ${event.order.code}`,
    );
    this.listen(
      RefundEvent,
      (event) => this.captureRefundCreated(event),
      (event) => `order ${event.order.code}`,
    );
    this.listen(
      RefundStateTransitionEvent,
      (event) => this.captureRefundStateTransition(event),
      (event) => `order ${event.order.code}`,
    );
    // Fulfillments
    this.listen(
      FulfillmentEvent,
      (event) => this.captureFulfillmentCreated(event),
      (event) =>
        `orders ${event.input?.orders.map((order) => order.code).join(', ')}`,
    );
    this.listen(
      FulfillmentStateTransitionEvent,
      (event) => this.captureFulfillmentStateTransition(event),
      (event) => `fulfillment ${event.fulfillment.id}`,
    );
  }

  /**
   * Runs `capture` for every event of `type`. Subscribers must not be async, so a failed
   * capture is logged with what the event refers to instead of being thrown.
   */
  private listen<T extends VendureEvent>(
    type: Type<T>,
    capture: (event: T) => Promise<void>,
    subject: (event: T) => string,
  ): void {
    this.eventBus.ofType(type).subscribe((event) => {
      capture(event).catch((e) => {
        const error = asError(e);
        Logger.error(
          `Failed to capture ${type.name} for ${subject(event)}: ${error.message}`,
          loggerCtx,
          error.stack,
        );
      });
    });
  }

  /**
   * Whether any strategy implements `hook`. Captures check this before reading the database;
   * `isEnabled` is evaluated once, by `dispatch`.
   */
  isImplemented(hook: HookName): boolean {
    return this.options.strategies.some((strategy) => hasHook(strategy, hook));
  }

  /**
   * Shared capture path: skips events no strategy listens to or without referenced orders,
   * then dispatches what `build` returns. `build` may read the database.
   */
  private async dispatchOrders<H extends HookName>(
    event: SourceEvent,
    hook: H,
    orders: readonly OrderRef[],
    build: () => PayloadParts<H> | Promise<PayloadParts<H>>,
  ): Promise<void> {
    const refs = this.isImplemented(hook) ? getOrderRefs(orders) : undefined;
    if (!refs) {
      return;
    }
    await this.dispatch(event.ctx, hook, {
      ...refs,
      ...(await build()),
      occurredAt: event.createdAt,
    });
  }

  private captureOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    return this.dispatchOrders(event, 'onOrderPlaced', [event.order], () => ({
      data: { fromState: event.fromState, toState: event.toState },
    }));
  }

  private captureOrderStateTransition(
    event: OrderStateTransitionEvent,
  ): Promise<void> {
    return this.dispatchOrders(
      event,
      'onOrderStateTransition',
      [event.order],
      () => ({
        data: { fromState: event.fromState, toState: event.toState },
      }),
    );
  }

  /** Captures creation and updates; order deletion has no hook. */
  private async captureOrderEvent(event: OrderEvent): Promise<void> {
    if (event.type === 'deleted') {
      return;
    }
    const hook = event.type === 'created' ? 'onOrderCreated' : 'onOrderUpdated';
    await this.dispatchOrders(event, hook, [event.entity], () => ({
      data: {},
      input: toOrderEventInput(event.input),
    }));
  }

  private captureOrderLine(event: OrderLineEvent): Promise<void> {
    return this.dispatchOrders(
      event,
      LINE_EVENT_HOOKS[event.type],
      [event.order],
      async () => ({
        data: {
          lineId: event.orderLine.id,
          lineSnapshot: await this.snapshotLine(event),
        },
      }),
    );
  }

  /** Line snapshot; a cancelled line also gets the quantity this event cancelled. */
  private async snapshotLine(event: OrderLineEvent): Promise<JsonObject> {
    const snapshot = snapshotOrderLine(event.orderLine);
    if (event.type !== 'cancelled') {
      return snapshot;
    }
    // Vendure publishes the line as it loaded it, before writing the reduced quantity
    const persisted = await this.connection
      .getRepository(event.ctx, OrderLine)
      .findOneBy({ id: event.orderLine.id });
    return {
      ...snapshot,
      cancelledQuantity: event.orderLine.quantity - (persisted?.quantity ?? 0),
    };
  }

  private capturePaymentStateTransition(
    event: PaymentStateTransitionEvent,
  ): Promise<void> {
    return this.dispatchOrders(
      event,
      'onPaymentStateTransition',
      [event.order],
      () => ({
        data: {
          fromState: event.fromState,
          toState: event.toState,
          paymentId: event.payment.id,
        },
      }),
    );
  }

  private captureRefundCreated(event: RefundEvent): Promise<void> {
    return this.dispatchOrders(event, 'onRefundCreated', [event.order], () => ({
      data: {
        refundId: event.refund.id,
        snapshot: snapshotRefund(event.refund),
      },
    }));
  }

  private captureRefundStateTransition(
    event: RefundStateTransitionEvent,
  ): Promise<void> {
    return this.dispatchOrders(
      event,
      'onRefundStateTransition',
      [event.order],
      () => ({
        data: {
          fromState: event.fromState,
          toState: event.toState,
          refundId: event.refund.id,
        },
      }),
    );
  }

  /** The referenced orders come from the event input. */
  private async captureFulfillmentCreated(
    event: FulfillmentEvent,
  ): Promise<void> {
    if (
      event.type !== 'created' ||
      !this.isImplemented('onFulfillmentCreated')
    ) {
      return;
    }
    const payload = buildFulfillmentCreatedPayload(event);
    if (!payload) {
      return;
    }
    await this.dispatch(event.ctx, 'onFulfillmentCreated', {
      ...payload,
      occurredAt: event.createdAt,
    });
  }

  /** The orders are always loaded through the fulfillment's `orders` relation. */
  private async captureFulfillmentStateTransition(
    event: FulfillmentStateTransitionEvent,
  ): Promise<void> {
    if (!this.isImplemented('onFulfillmentStateTransition')) {
      return;
    }
    const fulfillment = await this.connection
      .getRepository(event.ctx, Fulfillment)
      .findOne({
        where: { id: event.fulfillment.id },
        relations: { orders: true },
      });
    await this.dispatchOrders(
      event,
      'onFulfillmentStateTransition',
      fulfillment?.orders ?? [],
      () => ({
        data: {
          fromState: event.fromState,
          toState: event.toState,
          fulfillmentId: event.fulfillment.id,
        },
      }),
    );
  }
}
