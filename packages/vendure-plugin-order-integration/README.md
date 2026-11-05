# Vendure Order Integration Plugin

Framework for connecting Vendure orders to shipping, marketing, accounting and other platforms through your own strategies. Implement only the lifecycle hooks you need, from cart creation through placement, payment and fulfillment. Your strategy decides which orders to process or ignore. The plugin captures event data after the transaction commits, runs implemented hooks of enabled strategies as retried background jobs, keeps failed jobs visible and exposes one webhook route per strategy and connection.

[Official documentation here](https://engineering.pinelab.studio/plugin/vendure-plugin-order-integration)

This is a developer tool, not a ready-made integration. You own the API client, the payload mapping, external references, business rules, idempotency and every update to Vendure orders.

1. Write a class that implements `OrderIntegrationStrategy`, with only the hooks you need, for example `onOrderPlaced`.
2. Register it with `OrderIntegrationPlugin.init({ strategies: [...] })`.
3. Configure a retry backoff for the `order-integration` job queue, so the retries outlast an outage of the platform.
4. If the platform calls you back, point its webhooks at `/order-integration/:strategyName/:connectionId` and implement `onWebhookReceived`.

## Getting started

The plugin needs Vendure 3.3 or newer. It adds no entities, migrations, GraphQL API or Dashboard extension.

1. Install the package: `npm install @pinelab/vendure-plugin-order-integration`.
2. Write a strategy. `AcmeClient` is your own code: it maps the data and deduplicates requests by the idempotency key.

```ts
import { ID, Injector, Order, OrderService, RequestContext } from '@vendure/core';
import {
  OrderIntegrationEvent,
  OrderIntegrationStrategy,
  StateTransitionData,
} from '@pinelab/vendure-plugin-order-integration';

export interface AcmeClient {
  exportOrder(order: Order, options: { idempotencyKey: string }): Promise<void>;
  updateFulfillment(
    fulfillmentId: ID,
    fromState: string,
    toState: string,
    options: { idempotencyKey: string },
  ): Promise<void>;
}

export class AcmeOrderIntegration implements OrderIntegrationStrategy {
  readonly name = 'acme';
  private orderService!: OrderService;

  constructor(
    private readonly client: AcmeClient,
    private readonly channelId: ID,
  ) {}

  /** Vendure's strategy lifecycle: get the services you need from the injector. */
  init(injector: Injector): void {
    this.orderService = injector.get(OrderService);
  }

  /** Only handle events of the channel that has an Acme account. */
  isEnabled(ctx: RequestContext): boolean {
    return ctx.channelId === this.channelId;
  }

  /** Load the current order and export it. Do not update the Order here. */
  async onOrderPlaced(
    ctx: RequestContext,
    event: OrderIntegrationEvent<StateTransitionData>,
  ): Promise<void> {
    const order = await this.orderService.findOne(ctx, event.orderIds[0], [
      'lines',
      'lines.productVariant',
    ]);
    if (!order) {
      // Throwing fails the attempt: the job is retried
      throw new Error(`Order ${event.orderIds[0]} was not found`);
    }
    if (!order.orderPlacedAt) return; // also guard programmatic enqueue of carts
    // Don't catch errors of the platform: let the queue retry. Returning completes the job.
    await this.client.exportOrder(order, {
      idempotencyKey: `${this.name}:${ctx.channelId}:onOrderPlaced:${event.eventId}`,
    });
  }

  /** Deliver the original transition, even if the fulfillment has moved on since. */
  async onFulfillmentStateTransition(
    ctx: RequestContext,
    event: OrderIntegrationEvent<StateTransitionData & { fulfillmentId: ID }>,
  ): Promise<void> {
    await this.client.updateFulfillment(
      event.data.fulfillmentId,
      event.data.fromState,
      event.data.toState,
      {
        idempotencyKey: `${this.name}:${ctx.channelId}:onFulfillmentStateTransition:${event.eventId}`,
      },
    );
  }
}
```

3. Register the strategy in the config of both the server and the worker:

```ts
OrderIntegrationPlugin.init({
  // Names must be unique and stable: they appear in webhook URLs and job data
  strategies: [new AcmeOrderIntegration(acmeClient, 1)],
  // Retries after the first attempt. Default: 3
  retries: 3,
}),
```

| Option       | Default  | Description                                                                                                                       |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `strategies` | required | Your strategies. `init()` throws on duplicate names.                                                                              |
| `retries`    | `3`      | Retries per job after the first attempt. A `setRetries` in your `DefaultJobQueuePlugin` options overrides it.                     |

Only the worker processes jobs. A worker that restricts `jobQueueOptions.activeQueues` must include `order-integration`. Use a persistent job queue in production: with Vendure's in-memory queue, pending jobs are lost on restart.

## How it works

1. Vendure publishes an order event. The plugin receives it after the transaction that published it has committed, so events of rolled-back transactions (such as a `modifyOrder` dry run) are never delivered.
2. Cart and placed-order events are both eligible. The plugin checks that each strategy implements the matching hook and passes `isEnabled(ctx)` before creating its job.
3. For every strategy that implements the matching hook and is enabled for the channel (`isEnabled`), it captures the event once and adds one job to the `order-integration` queue, with the serialized `RequestContext`.
4. The worker restores the context and calls your hook with `(ctx, event)`.
5. Returning completes the job. Throwing retries the same hook with the identical event until the retries are exhausted; then the job stays `FAILED` on Vendure's Job Queue page. Every failed attempt is logged.

Jobs are independent: one failing job never affects another. There is no ordering and no exactly-once guarantee. Incoming webhooks skip the queue: the controller hands the request to `onWebhookReceived` and sends back its response.

## The strategy contract

A strategy has a required, stable `name` and these optional members: `init(injector)` and `destroy()` (Vendure's `InjectableStrategy` lifecycle), `isEnabled(ctx)`, the lifecycle hooks below and `onWebhookReceived(request)`. A hook you don't implement never creates a job.

### The event

| Field        | Description                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eventId`    | Random UUID, identical on every retry. The jobs of all strategies for one source event share it, so include the strategy name in idempotency keys.                          |
| `occurredAt` | ISO time at which Vendure created the event, not when the job runs.                                                                                                           |
| `route`      | `strategyName`, plus the `connectionId` you pass to `enqueue`. Events from Vendure have no `connectionId`: the account follows from the channel of `ctx`.                    |
| `orderIds`   | Ids of the referenced orders, never empty. Only fulfillments can span several orders.                                                                                             |
| `input`      | The mutation input, where Vendure supplies one: `onOrderCreated`, `onOrderUpdated` and `onFulfillmentCreated`.                                                                                  |
| `data`       | Hook-specific data, see below.                                                                                                                                                |

The event is plain JSON: dates are ISO strings and entities are reduced to ids. Ids are Vendure's database ids, also inside `input`.

### Hooks

| Hook                           | Vendure source                            | `event.data`                                      | When it fires                                                                                                     |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `onOrderCreated`               | `OrderEvent` `created`                    | `{}`, input when available                       | A new order or cart is created.                                                                                  |
| `onOrderPlaced`                | `OrderPlacedEvent`                        | `{ fromState, toState }`                          | The order is placed.                                                                                              |
| `onOrderStateTransition`       | `OrderStateTransitionEvent`               | `{ fromState, toState }`                          | Every order transition, including cart transitions, placement and `Cancelled`.                                   |
| `onOrderUpdated`               | `OrderEvent` `updated`                    | `{}`, the change is in `input`                    | An order update, including carts: for example `setOrderCustomFields`, `setOrderCustomer` or `modifyOrder`.                                    |
| `onOrderLineCreated`           | `OrderLineEvent` `created`                | `{ lineId, lineSnapshot }`                        | A cart or order gets a new line. The same line also fires `onOrderLineUpdated`.                                         |
| `onOrderLineUpdated`           | `OrderLineEvent` `updated`                | `{ lineId, lineSnapshot }`                        | A cart or order line is updated, including adding or adjusting quantities.                                                                   |
| `onOrderLineDeleted`           | `OrderLineEvent` `deleted`                | `{ lineId, lineSnapshot }`                        | A line is removed, normally while the order is in `AddingItems` or `Draft`.                        |
| `onOrderLineCancelled`         | `OrderLineEvent` `cancelled`              | `{ lineId, lineSnapshot }`                        | `cancelOrder`, or `modifyOrder` lowering a quantity (also to 0). A whole-order cancellation fires one per line.   |
| `onPaymentStateTransition`     | `PaymentStateTransitionEvent`             | `{ fromState, toState, paymentId }`               | Every payment transition, including the checkout payment.                             |
| `onRefundCreated`              | `RefundEvent` `created`                   | `{ refundId, snapshot }`                          | The primary refund of the Admin API `refundOrder` mutation.                                                       |
| `onRefundStateTransition`      | `RefundStateTransitionEvent`              | `{ fromState, toState, refundId }`                | Every refund transition.                                                                        |
| `onFulfillmentCreated`         | `FulfillmentEvent` `created`              | `{ fulfillmentId, snapshot }`                     | A fulfillment is created for one or more orders.                                                           |
| `onFulfillmentStateTransition` | `FulfillmentStateTransitionEvent`         | `{ fromState, toState, fulfillmentId }`           | Every fulfillment transition, including `Created` to `Pending` right after creation.                              |

Things to know:

- **Placement fires two hooks:** `onOrderPlaced` and `onOrderStateTransition`. Implement one, or filter on the states.
- **Cart events are delivered immediately**, not replayed at placement. Return early in your hooks when an order or transition is not relevant to your integration.
- **Refunds created by `modifyOrder`** publish no refund event. They reach you through `onRefundStateTransition` and `input.refunds` of `onOrderUpdated`.
- There is no `onOrderDeleted`: a cancellation is a state transition, a partial cancellation a line event.

### Snapshots

Snapshots show the entity as it was when the transaction committed. They are not complete before/after diffs: load the current order with `OrderService` when you need the full picture.

- **Line:** `id`, `productVariantId`, `quantity`, `orderPlacedQuantity`, `unitPrice`, `unitPriceWithTax`, `linePrice`, `linePriceWithTax` and `customFields`. For a cancellation, Vendure publishes the line as it was before, so `quantity` is the quantity before this cancellation and `cancelledQuantity` is the number of units this event cancelled (0 for lines that were already cancelled when a whole order is cancelled). `customFields` is serialized as loaded: keep relation custom fields on order lines out of eager loading, or they end up in every line snapshot.
- **Refund:** `id`, `state`, `total`, `reason`, `method`, `transactionId` and `paymentId`.
- **Fulfillment:** `id`, `state`, `method`, `trackingCode`, `handlerCode` and `lines` (`orderLineId`, `quantity`).

## Channel eligibility

Before enqueueing, the plugin checks that the strategy implements the matching hook, then awaits `isEnabled(ctx)` with the context of the source event. Without `isEnabled`, the strategy is enabled for every channel. Eligibility is not checked again on retries. `false` enqueues nothing for that strategy. A thrown error is logged and counts as disabled for that strategy only.

It is a channel check, not an order filter: to skip single orders, return early from the hook, so the job completes and nothing is sent. To serve several accounts, register one strategy per account with distinct names, or hold account-scoped clients in one strategy and pick one by `ctx.channel.token`; then add the channel to your idempotency keys.

## Webhooks

One controller serves all strategies at `/order-integration/:strategyName/:connectionId`, for every HTTP method. `connectionId` identifies the account that sends the request; a single-account strategy uses a fixed id such as `default`. An unknown strategy, a strategy without `onWebhookReceived` or a missing connection id gets an empty 404.

Webhooks are processed in the HTTP request: they are not queued and the plugin never retries them. Return an error status and the sender retries, so make processing safe to repeat.

`onWebhookReceived(request)` receives `route` (from the URL, untrusted until you authenticate), `method`, `headers`, `query`, `rawBody` (the exact bytes, empty without a body; verify signatures over these) and `body` (parsed only for a JSON content type that parses, otherwise `undefined`). Bodies are limited to 100 kB.

Return `{ statusCode, headers?, body? }`. A string body without `Content-Type` is sent as `text/plain`, a `Uint8Array` as `application/octet-stream` and anything else as JSON. When your hook throws, the plugin logs the error and answers an empty 500.

Security: the plugin does not authenticate requests. Verify the signature over `rawBody` with `crypto.timingSafeEqual` (after a length check), reject replays where the platform sends a timestamp or event id, and only then bind the connection to a channel from your own configuration and create the `RequestContext` for it. Route values and Vendure tokens authorize nothing.

## Programmatic enqueue

`OrderIntegrationService` sends a hook without a Vendure event, for example to resend an order after its job failed. It uses the same hook-presence check, channel eligibility, serialization and retries.

```ts
const jobs = await injector.get(OrderIntegrationService).enqueue(
  ctx, // a context for the channel of the orders
  'onOrderPlaced',
  {
    orderIds: [orderId],
    data: { fromState: 'ArrangingPayment', toState: 'PaymentSettled' },
  },
  { strategyName: 'acme' }, // optional: only this strategy, plus an optional connectionId
);
```

Orders not found in the channel of `ctx` are skipped, and it returns `[]` when nothing qualifies. An unknown strategy, or one without the hook, rejects. Every call creates a new `eventId`, so an idempotency key based on `eventId` treats a resend as a new event; use the order code when a platform must never get an order twice. The plugin does not replay missed events: use `enqueue` for recovery.

## Hook context

`ctx` is the `RequestContext` of the source event, restored on the worker: channel, language and session are those of the event. `ctx.currencyCode` falls back to the channel default, so use `order.currencyCode`. There is no active transaction: wrap several writes in `TransactionalConnection.withTransaction`. Job data contains the serialized context including the session token, visible to administrators who can read jobs.

## Retries and backoff

`retries` (default 3) is the number of retries after the first attempt. The job queue decides the wait between attempts: `DefaultJobQueuePlugin` waits a constant 1 second, so the default retries cover only a few seconds. Configure an exponential backoff for this queue:

```ts
DefaultJobQueuePlugin.init({
  // 5 s, 20 s, 45 s: about 70 seconds over the default 3 retries
  backoffStrategy: (queueName, attemptsMade) =>
    queueName === 'order-integration' ? attemptsMade ** 2 * 5000 : 1000,
  // All hooks share one queue; Vendure applies no job timeout, so give your API clients one
  concurrency: (queueName) => (queueName === 'order-integration' ? 3 : 1),
});
```

With `jobQueueOptions.prefix`, the prefix is part of the queue name. A `setRetries` returning a constant overrides the plugin option.

## Failures and alerting

After the last attempt a job stays `FAILED` with the last error message (shortened to 255 characters). In the Dashboard, open System > Job Queue, filter on queue `order-integration` and state `FAILED`, and enable the hidden Error and Attempts columns. Failed jobs are kept until Vendure's job clean-up removes them (`keepJobsCount`, default 1000).

Every failed attempt is logged at error level with the logger context `OrderIntegrationPlugin`, the strategy, hook, order codes and stack. Route it to Slack or email with the Alerting plugin:

```ts
AlertingPlugin.init({
  alerts: [
    new LogAlert([slack])
      .onLog('error')
      .filter((log) => log.loggerCtx === 'OrderIntegrationPlugin')
      // A constant text, so identical alerts are deduplicated during an outage
      .notify(() => ({
        subject: 'Order integration job failed',
        text: 'Check System > Job Queue, queue order-integration.',
      })),
  ],
  deduplicationWindowMs: 60_000,
});
```

Alerts fire per failed attempt, not only for the last one, because job queues count attempts differently and the plugin can't tell which attempt is the last.

## Useful service helpers

| Helper                                                               | Use it to                                                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `OrderService.findOne(ctx, id, relations)` / `findOneByCode`          | Load the current order in a hook or webhook.                                                    |
| `RequestContextService.create({ apiType: 'admin', channelOrToken })` | Create a trusted context for a channel, for example after authenticating a webhook.             |
| `OrderService.createFulfillment` / `transitionFulfillmentToState`    | Write tracking information back.                                                                |
| `OrderService.updateCustomFields` / `addNoteToOrder`                 | Store an external reference or outcome, outside `onOrderPlaced`.                                |
| `OrderIntegrationService.enqueue`                                    | Send a hook without a Vendure event.                                                            |

The tests contain working strategies in `test/simulated-providers.ts`: hooks, retries, idempotency, channel eligibility, and a signed webhook bound to a channel with a feedback-loop guard (`AcmeStrategy`).

## Your responsibilities

- **Idempotency.** A retried hook repeats its calls. Send the platform an idempotency key built from the strategy name, channel, hook and `eventId` (plus the connection when one strategy serves several).
- **Repeated partial actions.** A retry runs the whole hook again, including steps that already succeeded. Make each step safe to repeat (create if missing, upsert by key). The order can change between attempts: store the mapped payload if you need a stable request.
- **No ordering.** Jobs of one order can run in any order and at the same time. Send the state the platform should have, or throw when it doesn't know the order yet so the retry runs later.
- **Feedback loops.** Your updates to orders, for example from a webhook, fire your own hooks again. Recognise your own changes and skip them:

```ts
async onOrderUpdated(ctx: RequestContext, event: OrderIntegrationEvent) {
  const input = event.input as { customFields?: Record<string, unknown> } | undefined;
  if (input?.customFields && 'integrationStatus' in input.customFields) {
    return; // set by our own tracking webhook
  }
  // ... send the update
}
```

- **Do not update the `Order` in `onOrderPlaced`.** Vendure and other subscribers write the order around placement, and an update from this hook can race with those writes. Running hooks as jobs after commit makes that less likely, but doesn't remove it. Store external references later, from another hook or a webhook, or in your own table.
- **Exclusions.** Skip orders by returning from the hook, not by throwing. Hooks also receive cart events: load the order and check `order.orderPlacedAt` when your integration only handles placed orders.
- **Errors and timeouts.** Don't swallow platform errors; let the queue retry. Give API clients a timeout.

## Prerequisite products

Some platforms reject an order with products they don't know. Create those products in the hook, right before sending the order, with a step that is safe to repeat:

```ts
for (const line of order.lines) {
  if (!(await client.findProductBySku(line.productVariant.sku))) {
    await client.createProduct({ sku: line.productVariant.sku, name: line.productVariant.name });
  }
}
await client.exportOrder(order, { idempotencyKey });
```

Keeping products up to date is a separate synchronization that this plugin does not offer. The QLS plugin, for example, creates QLS products on `ProductVariantEvent` and its order push fails when a variant has no QLS product id; it does not push products during placement. A strategy can close that gap with the step above.

## Guide: ShipStation-style order export with tracking

Pseudocode for a shipping platform that receives each placed order and calls back with tracking. The client calls are illustrative.

```ts
export class ShipStationIntegration implements OrderIntegrationStrategy {
  readonly name = 'shipstation';

  // init(injector): get OrderService and RequestContextService

  async onOrderPlaced(ctx, event) {
    const order = await orderService.findOne(ctx, event.orderIds[0], ['lines', 'lines.productVariant']);
    if (!order) throw new Error(`Order ${event.orderIds[0]} not found`); // retried
    if (!order.orderPlacedAt) return;
    if (order.shippingAddress.countryCode === 'BE') return; // your own exclusion: job completes
    // Same orderKey on every attempt: the platform updates instead of duplicating
    await client.upsertOrder({ orderKey: order.code, shipTo: mapAddress(order), items: mapLines(order) });
  }

  async onWebhookReceived(request) {
    if (!hasValidSignature(request.rawBody, request.headers['x-signature'])) return { statusCode: 401 };
    if (request.route.connectionId !== 'default') return { statusCode: 404 };
    const { orderKey, trackingNumber } = request.body;
    const ctx = await requestContextService.create({ apiType: 'admin', channelOrToken: channelToken });
    const order = await orderService.findOneByCode(ctx, orderKey, ['lines']);
    if (!order) return { statusCode: 200 }; // not ours: stop the platform from retrying
    // Repeatable: reuse a fulfillment with this tracking code, ship it only while Pending
    const fulfillment = (await findFulfillmentByTrackingCode(ctx, order, trackingNumber))
      ?? (await orderService.createFulfillment(ctx, { lines: allLines(order), handler: manual(trackingNumber) }));
    if (fulfillment.state === 'Pending') {
      await orderService.transitionFulfillmentToState(ctx, fulfillment.id, 'Shipped');
    }
    return { statusCode: 200 };
  }
}
```

**Expected results.** The `onOrderPlaced` job completes and the platform holds one order keyed by the Vendure order code. An excluded order completes without a call. When the parcel ships, the webhook answers 200 and the order has a `Shipped` fulfillment with the tracking code; no job is created.

**Failure handling.** When the platform is down, the hook throws and the job retries with your backoff; the upsert makes repeats safe. When retries run out, the job stays `FAILED` and is logged; fix the cause and resend with `enqueue`. A bad signature gets 401 and nothing changes. A webhook that fails halfway answers 500; the platform's retry reuses the fulfillment.

**External order id.** Nothing is stored on the order at placement: the order code is the platform's `orderKey` and comes back in the webhook. If you need the platform's own id, keep it in your own table or write it to a custom field later, outside `onOrderPlaced`.

**Prerequisite products.** None: the platform takes items inline. If yours doesn't, add the create-if-missing step before `upsertOrder`.

## Guide: Klaviyo-style order events

Pseudocode for a marketing platform that records events on customer profiles. The client calls are illustrative.

```ts
export class KlaviyoIntegration implements OrderIntegrationStrategy {
  readonly name = 'klaviyo';

  async onOrderPlaced(ctx, event) {
    await this.send(ctx, event, 'onOrderPlaced', 'Placed Order');
  }

  async onOrderStateTransition(ctx, event) {
    // The placement transition arrives here too; onOrderPlaced handles it
    if (event.data.toState === 'Cancelled') await this.send(ctx, event, 'onOrderStateTransition', 'Cancelled Order');
  }

  private async send(ctx, event, hook, metric) {
    const order = await orderService.findOne(ctx, event.orderIds[0], ['customer', 'lines', 'lines.productVariant']);
    if (!order) throw new Error(`Order ${event.orderIds[0]} not found`);
    if (!order.orderPlacedAt) return; // only record placed orders
    if (!order.customer?.emailAddress) return; // can never be delivered: complete instead of retrying
    await client.createEvent({
      metric,
      email: order.customer.emailAddress,
      time: event.occurredAt, // when it happened in Vendure, not when the job ran
      uniqueId: `${this.name}:${ctx.channelId}:${hook}:${event.eventId}`, // recorded once across retries
      properties: { orderCode: order.code, value: order.totalWithTax / 100, currency: order.currencyCode },
    });
  }
}
```

**Expected results.** A placed order records one "Placed Order" event with the placement time, even when the job runs later or is retried. A cancellation records "Cancelled Order". An order without an email address completes without a call.

**Failure handling.** Rate limits, server errors and timeouts throw and are retried; the `uniqueId` keeps repeats harmless. Errors that retrying can't fix also throw, so the job ends up `FAILED` and visible; fix the mapping and resend with `enqueue`. A resend has a new `eventId`, so base the `uniqueId` on the order code when it must not create a second event.

**Prerequisite products.** None: the platform creates profiles and metrics on the first event, and the items travel inside the event properties.
