import { describe, expect, it } from 'vitest';
import { findStockShortfalls } from './stock-shortfall.util';

describe('findStockShortfalls', () => {
  it('Reports a line that was allocated more than the stock on hand', () => {
    const shortfalls = findStockShortfalls(
      { stockOnHand: 1, stockAllocated: 3 },
      [{ orderLineId: 'line-1', quantity: 3 }],
    );
    expect(shortfalls).toEqual([
      { orderLineId: 'line-1', requestedQuantity: 3, availableQuantity: 1 },
    ]);
  });

  it('Gives the free stock to the lines in allocation order and reports only the line that runs out', () => {
    // The first line gets 2, the second line only gets the remaining 1
    const shortfalls = findStockShortfalls(
      { stockOnHand: 3, stockAllocated: 4 },
      [
        { orderLineId: 'line-1', quantity: 2 },
        { orderLineId: 'line-2', quantity: 2 },
      ],
    );
    expect(shortfalls).toEqual([
      { orderLineId: 'line-2', requestedQuantity: 2, availableQuantity: 1 },
    ]);
  });

  it('Leaves nothing for lines when other orders already allocated the stock on hand', () => {
    // 5 allocated in total, 2 of them by this event: the 3 allocated elsewhere exceed the 1 on hand
    const shortfalls = findStockShortfalls(
      { stockOnHand: 1, stockAllocated: 5 },
      [{ orderLineId: 'line-1', quantity: 2 }],
    );
    expect(shortfalls).toEqual([
      { orderLineId: 'line-1', requestedQuantity: 2, availableQuantity: 0 },
    ]);
  });

  it('Reports a line that was allocated over two stock locations once, with the summed quantity', () => {
    const shortfalls = findStockShortfalls(
      { stockOnHand: 1, stockAllocated: 3 },
      [
        { orderLineId: 'line-1', quantity: 1 },
        { orderLineId: 'line-1', quantity: 2 },
      ],
    );
    expect(shortfalls).toEqual([
      { orderLineId: 'line-1', requestedQuantity: 3, availableQuantity: 1 },
    ]);
  });

  it('Reports nothing when the stock covers every allocation', () => {
    const shortfalls = findStockShortfalls(
      { stockOnHand: 10, stockAllocated: 3 },
      [{ orderLineId: 'line-1', quantity: 3 }],
    );
    expect(shortfalls).toEqual([]);
  });
});
