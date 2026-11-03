import type { AvailableStock, ID } from '@vendure/core';
import type { StockShortfallData } from '../types';

/** The quantity Vendure allocated to an order line at one stock location. */
export interface LineAllocation {
  readonly orderLineId: ID;
  readonly quantity: number;
}

/** A line of `onStockShortfall`: the allocated quantity and the part of it that was in stock. */
export type StockShortfallLine = StockShortfallData['lines'][number];

/**
 * Hands out the free stock of one tracked variant to the lines of one allocation event and
 * returns the lines that were allocated more than was in stock.
 *
 * `stock` is read after the event's allocations were saved, so its `stockAllocated` includes
 * them: the stock that was free before the event is `stockOnHand - (stockAllocated - A)`,
 * never below 0, where A is the event's total allocation of the variant. The out-of-stock
 * threshold is ignored on purpose. The free stock goes to the lines in allocation order. A
 * line allocated over several stock locations has several allocations and is reported once,
 * with their sum as `requestedQuantity`.
 *
 * @param stock Totals of the variant after the event's allocations were saved.
 * @param allocations The event's allocations of this variant, in allocation order.
 */
export function findStockShortfalls(
  stock: AvailableStock,
  allocations: readonly LineAllocation[],
): StockShortfallLine[] {
  // Sum the allocations per line; a Map keeps the allocation order
  const requestedByLine = new Map<ID, number>();
  let allocatedInEvent = 0;
  for (const { orderLineId, quantity } of allocations) {
    requestedByLine.set(
      orderLineId,
      (requestedByLine.get(orderLineId) ?? 0) + quantity,
    );
    allocatedInEvent += quantity;
  }
  // Give the stock that was free before the event to the lines, one by one
  let freeStock = Math.max(
    0,
    stock.stockOnHand - (stock.stockAllocated - allocatedInEvent),
  );
  const shortfalls: StockShortfallLine[] = [];
  for (const [orderLineId, requestedQuantity] of requestedByLine) {
    const availableQuantity = Math.min(requestedQuantity, freeStock);
    freeStock -= availableQuantity;
    if (availableQuantity < requestedQuantity) {
      shortfalls.push({ orderLineId, requestedQuantity, availableQuantity });
    }
  }
  return shortfalls;
}
