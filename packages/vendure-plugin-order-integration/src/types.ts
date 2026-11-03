import type { ID, InjectableStrategy, RequestContext } from '@vendure/core';

/** A JSON-safe value. Payloads never contain live entities or `Date` objects. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** A JSON-safe object, used for event-time snapshots. */
export type JsonObject = { readonly [key: string]: JsonValue };

/** Return type of every lifecycle hook. Throwing or rejecting fails the job attempt. */
export type HookResult = void | Promise<void>;

/** Routing of an event or webhook to a strategy and, optionally, one of its connections. */
export interface OrderIntegrationRoute {
  readonly strategyName: string;
  /** Stable configured connection identifier, never a secret. */
  readonly connectionId?: string;
}

/** The event passed to a lifecycle hook. Identical on every retry of the same job. */
export interface OrderIntegrationEvent<TData = JsonObject> {
  /** Stable source identity, unchanged across retries. */
  readonly eventId: string;
  /** ISO-8601 event occurrence time, not worker execution time. */
  readonly occurredAt: string;
  readonly route: OrderIntegrationRoute;
  /** Fulfillments may reference multiple eligible placed orders. */
  readonly orderIds: readonly [ID, ...ID[]];
  /** Original supplied mutation input, when available. */
  readonly input?: JsonValue;
  readonly data: TData;
}

/** Original from and to states of a transition. */
export interface StateTransitionData {
  readonly fromState: string;
  readonly toState: string;
}

/** Data of the order line hooks. */
export interface OrderLineEventData {
  readonly lineId: ID;
  /** Event-time snapshot, including before deletion if applicable. */
  readonly lineSnapshot: JsonObject;
}

/** Data of `onRefundCreated`. */
export interface RefundCreatedData {
  readonly refundId: ID;
  readonly snapshot: JsonObject;
}

/** Data of `onFulfillmentCreated`. */
export interface FulfillmentCreatedData {
  readonly fulfillmentId: ID;
  readonly snapshot: JsonObject;
}

/** Data of `onStockShortfall`: quantities as determined when Vendure allocated the stock. */
export interface StockShortfallData {
  /** Preserve source-event quantities; confirm mapping in its adapter. */
  readonly lines: readonly {
    readonly orderLineId: ID;
    readonly requestedQuantity: number;
    readonly availableQuantity: number;
  }[];
}

/** An inbound HTTP request for `onWebhookReceived`. */
export interface OrderIntegrationWebhookRequest {
  /** Untrusted route values until the strategy authenticates the request. */
  readonly route: { strategyName: string; connectionId: string };
  readonly method: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly query: Readonly<Record<string, unknown>>;
  /** Exact bytes for signature verification, not re-serialized JSON. */
  readonly rawBody: Uint8Array;
  readonly body: unknown;
}

/** The HTTP response a strategy returns from `onWebhookReceived`. */
export interface OrderIntegrationWebhookResponse {
  readonly statusCode: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

/** Implemented lifecycle hooks run as independent jobs, without ordering guarantees. */
export interface OrderIntegrationStrategy extends InjectableStrategy {
  /** Stable, unique configured strategy name. */
  readonly name: string;

  /** Channel eligibility; omitted means enabled. Not an order-level filter. */
  isEnabled?(ctx: RequestContext): boolean | Promise<boolean>;

  /** Process an update to an already placed order. */
  onOrderUpdated?(
    ctx: RequestContext,
    event: OrderIntegrationEvent,
  ): HookResult;

  /** Process placement and its original transition. Do not update the Order. */
  onOrderPlaced?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<StateTransitionData>,
  ): HookResult;

  /** Process an original order transition, including cancellation. */
  onOrderStateTransition?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<StateTransitionData>,
  ): HookResult;

  /** Process an added line using its event-time snapshot. */
  onOrderLineCreated?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<OrderLineEventData>,
  ): HookResult;

  /** Process a changed line; not a guaranteed complete before/after diff. */
  onOrderLineUpdated?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<OrderLineEventData>,
  ): HookResult;

  /** Process a removed line without relying on its continued existence. */
  onOrderLineDeleted?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<OrderLineEventData>,
  ): HookResult;

  /** Process cancellation using event-time line data and supplied input. */
  onOrderLineCancelled?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<OrderLineEventData>,
  ): HookResult;

  /** Process a payment's original transition. */
  onPaymentStateTransition?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<StateTransitionData & { paymentId: ID }>,
  ): HookResult;

  /** Process refund creation with event-time data. */
  onRefundCreated?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<RefundCreatedData>,
  ): HookResult;

  /** Process a refund's original transition. */
  onRefundStateTransition?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<StateTransitionData & { refundId: ID }>,
  ): HookResult;

  /** Process fulfillment creation for eligible placed orders only. */
  onFulfillmentCreated?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<FulfillmentCreatedData>,
  ): HookResult;

  /** Process a fulfillment's original transition for eligible orders only. */
  onFulfillmentStateTransition?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<StateTransitionData & { fulfillmentId: ID }>,
  ): HookResult;

  /** Process event-time shortfalls, not current stock levels. */
  onStockShortfall?(
    ctx: RequestContext,
    event: OrderIntegrationEvent<StockShortfallData>,
  ): HookResult;

  /** Authenticate, resolve trusted context, process, and return the HTTP response. */
  onWebhookReceived?(
    request: OrderIntegrationWebhookRequest,
  ): Promise<OrderIntegrationWebhookResponse>;
}

/** Name of one of the thirteen lifecycle hooks. */
export type HookName =
  | 'onOrderPlaced'
  | 'onOrderUpdated'
  | 'onOrderStateTransition'
  | 'onOrderLineCreated'
  | 'onOrderLineUpdated'
  | 'onOrderLineDeleted'
  | 'onOrderLineCancelled'
  | 'onPaymentStateTransition'
  | 'onRefundCreated'
  | 'onRefundStateTransition'
  | 'onFulfillmentCreated'
  | 'onFulfillmentStateTransition'
  | 'onStockShortfall';

/** The `data` type of a hook's event, derived from the strategy method signature. */
export type HookData<H extends HookName> =
  Parameters<
    NonNullable<OrderIntegrationStrategy[H]>
  >[1] extends OrderIntegrationEvent<infer TData>
    ? TData
    : never;

/** Payload of {@link OrderIntegrationService.enqueue}. */
export interface EnqueuePayload<H extends HookName> {
  /** Ids of placed orders in the caller's channel; orders that are not placed are skipped. */
  readonly orderIds: readonly [ID, ...ID[]];
  readonly data: HookData<H>;
  readonly input?: JsonValue;
}

/** Options of {@link OrderIntegrationPlugin.init}. */
export interface OrderIntegrationPluginOptions {
  /** Strategies with unique names. Each one receives only the hooks it implements. */
  strategies: OrderIntegrationStrategy[];
  /**
   * Retries per job after the first attempt. A consumer's `DefaultJobQueuePlugin`
   * `setRetries` overrides it for the `order-integration` queue. Default: 10.
   */
  retries?: number;
}
