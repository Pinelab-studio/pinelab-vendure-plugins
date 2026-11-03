import {
  Customer,
  FulfillmentEvent,
  ID,
  Json,
  OrderEvent,
  OrderLine,
  Refund,
} from '@vendure/core';
import type { FulfillmentCreatedData, JsonObject } from '../types';

/** The part of an `Order` that decides whether a hook is dispatched for it. */
export interface OrderRef {
  readonly id: ID;
  readonly code: string;
  readonly orderPlacedAt?: Date | null;
}

/** Ids and codes of the placed orders an event is dispatched for. */
export interface PlacedOrderRefs {
  orderIds: [ID, ...ID[]];
  orderCodes: string[];
}

/** Payload of `onFulfillmentCreated`, captured from a `FulfillmentEvent` without reading the database. */
export interface FulfillmentCreatedPayload extends PlacedOrderRefs {
  data: FulfillmentCreatedData;
  input?: Json;
}

/**
 * Converts a plain value to fresh, mutable JSON: dates become ISO strings and members that are
 * `undefined` are dropped. Returns `undefined` for `undefined`. Never pass live entities.
 */
export function toJson(value: unknown): Json | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Json;
}

/**
 * Keeps the placed orders (those with `orderPlacedAt`) and returns their ids and codes.
 * Returns `undefined` when none is placed, which means nothing is dispatched.
 */
export function getPlacedOrderRefs(
  orders: readonly OrderRef[],
): PlacedOrderRefs | undefined {
  const placed = orders.filter((order) => order.orderPlacedAt);
  if (placed.length === 0) {
    return undefined;
  }
  const [firstId, ...otherIds] = placed.map((order) => order.id);
  return {
    orderIds: [firstId, ...otherIds],
    orderCodes: placed.map((order) => order.code),
  };
}

/**
 * Event-time snapshot of an order line. The prices are `OrderLine` getters that need no
 * relations, and the variant id is read from the line itself because lines published for
 * cancellations carry no `productVariant` relation.
 */
export function snapshotOrderLine(line: OrderLine): JsonObject {
  return {
    id: line.id,
    productVariantId: line.productVariantId ?? line.productVariant?.id ?? null,
    quantity: line.quantity,
    orderPlacedQuantity: line.orderPlacedQuantity,
    unitPrice: line.unitPrice,
    unitPriceWithTax: line.unitPriceWithTax,
    linePrice: line.linePrice,
    linePriceWithTax: line.linePriceWithTax,
    customFields: toJson(line.customFields) ?? {},
  };
}

/** Event-time snapshot of a refund. Line-based refunds are deprecated, so it holds no lines. */
export function snapshotRefund(refund: Refund): JsonObject {
  return {
    id: refund.id,
    state: refund.state,
    total: refund.total,
    reason: refund.reason ?? null,
    method: refund.method,
    transactionId: refund.transactionId ?? null,
    paymentId: refund.paymentId ?? refund.payment?.id ?? null,
  };
}

/**
 * JSON form of the input of an updated `OrderEvent`. Vendure passes a `Customer` entity when
 * the customer of an order is changed, which is reduced to `{ customerId }`.
 */
export function toOrderUpdatedInput(
  input: OrderEvent['input'],
): Json | undefined {
  return input instanceof Customer ? { customerId: input.id } : toJson(input);
}

/**
 * Captures a created fulfillment. The orders of the event are filtered to the placed ones and
 * `undefined` is returned when none remain, so nothing is dispatched. The snapshot lines come
 * from the event input, because Vendure publishes the fulfillment before its lines and orders
 * are attached. The input is returned with its orders reduced to ids.
 */
export function buildFulfillmentCreatedPayload(
  event: FulfillmentEvent,
): FulfillmentCreatedPayload | undefined {
  const { entity: fulfillment, input } = event;
  if (!input) {
    return undefined;
  }
  // Nothing is dispatched when no referenced order is placed
  const refs = getPlacedOrderRefs(input.orders);
  if (!refs) {
    return undefined;
  }
  return {
    ...refs,
    data: {
      fulfillmentId: fulfillment.id,
      snapshot: {
        id: fulfillment.id,
        state: fulfillment.state,
        method: fulfillment.method,
        trackingCode: fulfillment.trackingCode,
        handlerCode: fulfillment.handlerCode,
        // The fulfillment has no lines attached yet, so they come from the input
        lines: input.lines.map(({ orderLineId, quantity }) => ({
          orderLineId,
          quantity,
        })),
      },
    },
    input: toJson({ ...input, orders: input.orders.map((order) => order.id) }),
  };
}
