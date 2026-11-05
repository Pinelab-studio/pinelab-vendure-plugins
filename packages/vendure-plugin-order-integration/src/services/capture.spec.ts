import {
  Fulfillment,
  FulfillmentEvent,
  Order,
  RequestContext,
} from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { buildFulfillmentCreatedPayload } from './capture';

describe('Fulfillments that span several orders', () => {
  it('Captures every referenced order regardless of placement', () => {
    const event = createFulfillmentEvent([
      new Order({
        id: 1,
        code: 'PLACED-1',
        orderPlacedAt: new Date('2026-11-01T10:00:00.000Z'),
      }),
      new Order({ id: 2, code: 'CART-2' }),
      new Order({
        id: 3,
        code: 'PLACED-3',
        orderPlacedAt: new Date('2026-11-02T10:00:00.000Z'),
      }),
    ]);

    const payload = buildFulfillmentCreatedPayload(event);

    expect(payload?.orderIds).toEqual([1, 2, 3]);
    expect(payload?.orderCodes).toEqual(['PLACED-1', 'CART-2', 'PLACED-3']);
  });

  it('Captures nothing without referenced orders', () => {
    const event = createFulfillmentEvent([]);

    expect(buildFulfillmentCreatedPayload(event)).toBeUndefined();
  });
});

function createFulfillmentEvent(orders: Order[]): FulfillmentEvent {
  const fulfillment = new Fulfillment({
    id: 10,
    state: 'Created',
    method: 'Test method',
    trackingCode: 'TRACK-1',
    handlerCode: 'manual-fulfillment',
  });
  return new FulfillmentEvent(RequestContext.empty(), fulfillment, {
    orders,
    lines: [{ orderLineId: 100, quantity: 1 }],
    handler: { code: 'manual-fulfillment', arguments: [] },
  });
}
