import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  DefaultLogger,
  type ID,
  type Injector,
  LanguageCode,
  LogLevel,
  type Order,
  OrderService,
  PaymentMethodHandler,
  type RequestContext,
  RequestContextService,
  type VendureLogger,
} from '@vendure/core';
import type {
  HookName,
  OrderIntegrationEvent,
  OrderIntegrationStrategy,
  OrderIntegrationWebhookRequest,
  OrderIntegrationWebhookResponse,
} from '../src';

/** The event a hook of the given name receives. */
type HookEvent<H extends HookName> = Parameters<
  NonNullable<OrderIntegrationStrategy[H]>
>[1];

/** Produces the response of a simulated provider's webhook endpoint. */
type WebhookResponder = (
  request: OrderIntegrationWebhookRequest,
) => OrderIntegrationWebhookResponse | Promise<OrderIntegrationWebhookResponse>;

const respondWith200: WebhookResponder = () => ({ statusCode: 200 });

/** A request received by a simulated provider API. */
export interface ProviderRequest {
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

/**
 * Simulated provider API: records every request, but applies the effect of an
 * idempotency key only once, like a provider that supports idempotency keys.
 */
export class SimulatedClient {
  /** Every request received, including repeated ones. */
  readonly requests: ProviderRequest[] = [];
  /** The applied effects: one per distinct idempotency key. */
  readonly effects: ProviderRequest[] = [];
  private readonly appliedKeys = new Set<string>();

  /** Receives a request and applies its effect when the key has not been seen before. */
  send(request: ProviderRequest): void {
    this.requests.push(structuredClone(request));
    if (this.appliedKeys.has(request.idempotencyKey)) {
      return;
    }
    this.appliedKeys.add(request.idempotencyKey);
    this.effects.push(structuredClone(request));
  }

  /** The requests whose payload references the given order code. */
  requestsForOrder(orderCode: string): ProviderRequest[] {
    return this.requests.filter(
      (request) => request.payload.orderCode === orderCode,
    );
  }
}

/** What a hook received. The event is a deep copy, so job data can't change it later. */
export interface RecordedInvocation {
  hook: HookName;
  channelToken: string;
  languageCode: string;
  event: OrderIntegrationEvent<object>;
  /** Code of the order the hook loaded through the OrderService, once loaded. */
  loadedOrderCode?: string;
}

/**
 * Base of the simulated strategies: records every hook invocation and loads the
 * order through the `OrderService` it obtains in `init(injector)`.
 */
export abstract class RecordingStrategy implements OrderIntegrationStrategy {
  abstract readonly name: string;
  /** Every hook invocation, in order of arrival. */
  readonly invocations: RecordedInvocation[] = [];
  protected orderService!: OrderService;

  init(injector: Injector): void {
    this.orderService = injector.get(OrderService);
  }

  /** The invocations for an order id (as found in `event.orderIds`), optionally of one hook. */
  invocationsFor(orderId: ID, hook?: HookName): RecordedInvocation[] {
    return this.invocations.filter(
      (invocation) =>
        invocation.event.orderIds.some(
          (id) => String(id) === String(orderId),
        ) &&
        (hook === undefined || invocation.hook === hook),
    );
  }

  /** Records the invocation, then loads and returns the event's first order. */
  protected async receive(
    hook: HookName,
    ctx: RequestContext,
    event: OrderIntegrationEvent<object>,
  ): Promise<Order> {
    const invocation: RecordedInvocation = {
      hook,
      channelToken: ctx.channel.token,
      languageCode: ctx.languageCode,
      event: structuredClone(event),
    };
    this.invocations.push(invocation);
    const order = await this.orderService.findOne(ctx, event.orderIds[0]);
    if (!order) {
      throw new Error(
        `Order ${event.orderIds[0]} not found in channel ${ctx.channel.token}`,
      );
    }
    invocation.loadedOrderCode = order.code;
    return order;
  }

  /** The idempotency key for one event of one hook: `name:channelId:hook:eventId`. */
  protected idempotencyKey(
    hook: HookName,
    ctx: RequestContext,
    event: OrderIntegrationEvent<object>,
  ): string {
    return `${this.name}:${ctx.channelId}:${hook}:${event.eventId}`;
  }
}

/** A failure planned for one hook of one order. */
interface PlannedFailure {
  remaining: number;
  beforeFailing?: () => Promise<void>;
}

/**
 * Warehouse platform: implements all thirteen lifecycle hooks and has no
 * `isEnabled`, so it is enabled for every channel. It skips orders shipped to
 * Belgium, a consumer-owned exclusion rule. Its webhook endpoint records every
 * request and answers with whatever `respond` returns.
 */
export class WarehouseStrategy extends RecordingStrategy {
  readonly name = 'warehouse';
  readonly client = new SimulatedClient();
  /** Webhook requests received, oldest first. */
  webhookRequests: OrderIntegrationWebhookRequest[] = [];
  /** Produces the response of the following webhooks; replaced per test. */
  respond: WebhookResponder = respondWith200;
  private readonly plannedFailures = new Map<string, PlannedFailure>();

  /** Records the request and answers with the response `respond` produces. */
  async onWebhookReceived(
    request: OrderIntegrationWebhookRequest,
  ): Promise<OrderIntegrationWebhookResponse> {
    this.webhookRequests.push(request);
    return this.respond(request);
  }

  /** Forgets the recorded webhook requests and restores the default 200 response. */
  resetWebhooks(): void {
    this.webhookRequests = [];
    this.respond = respondWith200;
  }

  /**
   * Makes `hook` fail for the order with this code: `times` attempts (always, by
   * default) after sending its request, with the message 'Simulated provider
   * outage'. `beforeFailing` runs before each failure.
   */
  failOrder(
    orderCode: string,
    hook: HookName,
    options: { times?: number; beforeFailing?: () => Promise<void> } = {},
  ): void {
    this.plannedFailures.set(`${orderCode}:${hook}`, {
      remaining: options.times ?? Number.POSITIVE_INFINITY,
      beforeFailing: options.beforeFailing,
    });
  }

  onOrderUpdated(ctx: RequestContext, event: HookEvent<'onOrderUpdated'>) {
    return this.handle('onOrderUpdated', ctx, event);
  }

  onOrderPlaced(ctx: RequestContext, event: HookEvent<'onOrderPlaced'>) {
    return this.handle('onOrderPlaced', ctx, event);
  }

  onOrderStateTransition(
    ctx: RequestContext,
    event: HookEvent<'onOrderStateTransition'>,
  ) {
    return this.handle('onOrderStateTransition', ctx, event);
  }

  onOrderLineCreated(
    ctx: RequestContext,
    event: HookEvent<'onOrderLineCreated'>,
  ) {
    return this.handle('onOrderLineCreated', ctx, event);
  }

  onOrderLineUpdated(
    ctx: RequestContext,
    event: HookEvent<'onOrderLineUpdated'>,
  ) {
    return this.handle('onOrderLineUpdated', ctx, event);
  }

  onOrderLineDeleted(
    ctx: RequestContext,
    event: HookEvent<'onOrderLineDeleted'>,
  ) {
    return this.handle('onOrderLineDeleted', ctx, event);
  }

  onOrderLineCancelled(
    ctx: RequestContext,
    event: HookEvent<'onOrderLineCancelled'>,
  ) {
    return this.handle('onOrderLineCancelled', ctx, event);
  }

  onPaymentStateTransition(
    ctx: RequestContext,
    event: HookEvent<'onPaymentStateTransition'>,
  ) {
    return this.handle('onPaymentStateTransition', ctx, event);
  }

  onRefundCreated(ctx: RequestContext, event: HookEvent<'onRefundCreated'>) {
    return this.handle('onRefundCreated', ctx, event);
  }

  onRefundStateTransition(
    ctx: RequestContext,
    event: HookEvent<'onRefundStateTransition'>,
  ) {
    return this.handle('onRefundStateTransition', ctx, event);
  }

  onFulfillmentCreated(
    ctx: RequestContext,
    event: HookEvent<'onFulfillmentCreated'>,
  ) {
    return this.handle('onFulfillmentCreated', ctx, event);
  }

  onFulfillmentStateTransition(
    ctx: RequestContext,
    event: HookEvent<'onFulfillmentStateTransition'>,
  ) {
    return this.handle('onFulfillmentStateTransition', ctx, event);
  }

  onStockShortfall(ctx: RequestContext, event: HookEvent<'onStockShortfall'>) {
    return this.handle('onStockShortfall', ctx, event);
  }

  /** Maps the event to one request, then fails when a failure is planned for the order. */
  private async handle(
    hook: HookName,
    ctx: RequestContext,
    event: OrderIntegrationEvent<object>,
  ): Promise<void> {
    const order = await this.receive(hook, ctx, event);
    // Consumer-owned exclusion: the job completes without a request
    if (order.shippingAddress?.countryCode === 'BE') {
      return;
    }
    this.client.send({
      idempotencyKey: this.idempotencyKey(hook, ctx, event),
      payload: {
        orderCode: order.code,
        hook,
        skus: order.lines.map((line) => line.productVariant.sku),
      },
    });
    const failure = this.plannedFailures.get(`${order.code}:${hook}`);
    if (failure && failure.remaining > 0) {
      failure.remaining -= 1;
      await failure.beforeFailing?.();
      throw new Error('Simulated provider outage');
    }
  }
}

/** Marketing platform: implements only `onOrderPlaced`, with its own mapping and client. */
export class MarketingStrategy extends RecordingStrategy {
  readonly name = 'marketing';
  readonly client = new SimulatedClient();

  async onOrderPlaced(
    ctx: RequestContext,
    event: HookEvent<'onOrderPlaced'>,
  ): Promise<void> {
    const order = await this.receive('onOrderPlaced', ctx, event);
    this.client.send({
      idempotencyKey: this.idempotencyKey('onOrderPlaced', ctx, event),
      payload: {
        event: 'Placed Order',
        orderCode: order.code,
        email: order.customer?.emailAddress,
        value: order.totalWithTax,
      },
    });
  }
}

/** The accounts of the `acme` platform, which map to channel tokens. */
type AcmeAccount = 'eu' | 'us';

/**
 * Account-scoped platform: enabled only for the channels `eu` and `us`, and picks
 * the API client of the account that matches `ctx.channel.token`. It is also the
 * reference for the rules of a webhook strategy:
 *
 * 1. Verify the signature over the raw bytes in constant time before reading anything else.
 * 2. Bind the connection id of the URL to a trusted channel, and only touch orders of that channel.
 * 3. Reject invalid requests without reading or changing an order.
 * 4. Guard against feedback loops: the webhook updates `integrationStatus`, which fires
 *    `onOrderUpdated` again, so that hook ignores updates that touch `integrationStatus`.
 */
export class AcmeStrategy extends RecordingStrategy {
  readonly name = 'acme';
  readonly clients: Record<AcmeAccount, SimulatedClient> = {
    eu: new SimulatedClient(),
    us: new SimulatedClient(),
  };
  /** The secret each account signs its webhooks with; the connection id is the channel token. */
  readonly signingSecrets: Record<AcmeAccount, string> = {
    eu: 'eu-signing-secret',
    us: 'us-signing-secret',
  };
  /** Makes `isEnabled` throw, to show that one broken eligibility check affects no other strategy. */
  throwInIsEnabled = false;
  private requestContextService!: RequestContextService;

  /** Also obtains the service that creates the trusted context of a connection. */
  init(injector: Injector): void {
    super.init(injector);
    this.requestContextService = injector.get(RequestContextService);
  }

  isEnabled(ctx: RequestContext): boolean {
    if (this.throwInIsEnabled) {
      throw new Error('acme isEnabled failed: Simulated eligibility outage');
    }
    return ctx.channel.token === 'eu' || ctx.channel.token === 'us';
  }

  async onOrderPlaced(
    ctx: RequestContext,
    event: HookEvent<'onOrderPlaced'>,
  ): Promise<void> {
    const order = await this.receive('onOrderPlaced', ctx, event);
    this.clients[ctx.channel.token as AcmeAccount].send({
      idempotencyKey: this.idempotencyKey('onOrderPlaced', ctx, event),
      payload: { orderCode: order.code, account: ctx.channel.token },
    });
  }

  /** Sends order updates to Acme, except the ones this strategy caused itself. */
  async onOrderUpdated(
    ctx: RequestContext,
    event: HookEvent<'onOrderUpdated'>,
  ): Promise<void> {
    const order = await this.receive('onOrderUpdated', ctx, event);
    const input = event.input as
      | { customFields?: Record<string, unknown> }
      | undefined;
    if (input?.customFields && 'integrationStatus' in input.customFields) {
      return; // Feedback-loop guard: this is the update made by our own webhook
    }
    this.clients[ctx.channel.token as AcmeAccount].send({
      idempotencyKey: this.idempotencyKey('onOrderUpdated', ctx, event),
      payload: { orderCode: order.code, account: ctx.channel.token },
    });
  }

  /** Authenticates the webhook, then marks the referenced order as shipped. */
  async onWebhookReceived(
    request: OrderIntegrationWebhookRequest,
  ): Promise<OrderIntegrationWebhookResponse> {
    // Authenticate first: the route values are untrusted until the signature is valid
    const account = request.route.connectionId as AcmeAccount;
    const secret = this.signingSecrets[account];
    const signature = request.headers['x-acme-signature'];
    if (
      !secret ||
      typeof signature !== 'string' ||
      !isValidSignature(secret, request.rawBody, signature)
    ) {
      return { statusCode: 401 };
    }
    const orderCode = (request.body as { orderCode?: unknown } | undefined)
      ?.orderCode;
    if (typeof orderCode !== 'string') {
      return { statusCode: 400 };
    }
    // The context of the account's channel only finds orders of that channel
    const ctx = await this.requestContextService.create({
      apiType: 'admin',
      channelOrToken: account,
    });
    const order = await this.orderService.findOneByCode(ctx, orderCode, []);
    if (!order) {
      return { statusCode: 403 };
    }
    await this.orderService.updateCustomFields(ctx, order.id, {
      integrationStatus: 'shipped',
    });
    return { statusCode: 200 };
  }
}

/**
 * Payment method that only authorizes at checkout: the order is placed as
 * `PaymentAuthorized` and the payment is settled later by an administrator.
 */
export const authorizeOnlyPaymentMethod = new PaymentMethodHandler({
  code: 'authorize-only',
  description: [
    { languageCode: LanguageCode.en, value: 'Authorize Only Payment Method' },
  ],
  args: {},
  createPayment: (_ctx, _order, amount) => ({
    amount,
    state: 'Authorized',
    transactionId: 'AUTH-1',
  }),
  settlePayment: () => ({ success: true }),
});

/** Logger that keeps every error entry for assertions and forwards all entries to a `DefaultLogger`. */
export class RecordingLogger implements VendureLogger {
  /** Every error logged, with the logger context it was logged under. */
  readonly errors: { message: string; context?: string; trace?: string }[] = [];
  private readonly delegate = new DefaultLogger({ level: LogLevel.Debug });

  error(message: string, context?: string, trace?: string): void {
    this.errors.push({ message: String(message), context, trace });
    this.delegate.error(message, context, trace);
  }

  warn(message: string, context?: string): void {
    this.delegate.warn(message, context);
  }

  info(message: string, context?: string): void {
    this.delegate.info(message, context);
  }

  verbose(message: string, context?: string): void {
    this.delegate.verbose(message, context);
  }

  debug(message: string, context?: string): void {
    this.delegate.debug(message, context);
  }
}

/**
 * Checks a hex HMAC-SHA256 signature over the raw body in constant time. The length is
 * compared first, because `timingSafeEqual` throws when the lengths differ.
 */
function isValidSignature(
  secret: string,
  rawBody: Uint8Array,
  signature: string,
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
