import { describe, it, expect } from 'vitest';
import { getRelatedProductsPerProduct } from './util'; // Adjust the import path as needed

describe('getRelatedProductsPerProduct', () => {
  it('should return related products for a given product', () => {
    const itemSets = [
      {
        support: 1,
        items: [1, 2, 3],
      },
      {
        support: 99,
        items: [2, 3, 4],
      },
      {
        support: 3,
        items: [1, 3, 4],
      },
    ];
    const result = getRelatedProductsPerProduct(itemSets);
    // Should yield this specific order, because it should sort by support level
    expect(result.get(1)).toEqual([3, 4, 2]);
    expect(result.get(2)).toEqual([3, 4, 1]);
    expect(result.get(3)).toEqual([2, 4, 1]);
    expect(result.get(4)).toEqual([2, 3, 1]);
  });
});
