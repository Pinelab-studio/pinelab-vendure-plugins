import { describe, it, expect } from 'vitest';
import { getRelatedProductsPerProduct } from './util'; // Adjust the import path as needed

describe('getRelatedProductsPerProduct', () => {
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

  it('should return related products for a given product', () => {
    const result = getRelatedProductsPerProduct(itemSets, 3);
    expect(result.get(1)).toEqual([
      { productId: 3, support: 3 },
      { productId: 4, support: 3 },
      { productId: 2, support: 1 },
    ]);
    expect(result.get(2)).toEqual([
      { productId: 3, support: 99 },
      { productId: 4, support: 99 },
      { productId: 1, support: 1 },
    ]);
    expect(result.get(3)).toEqual([
      { productId: 2, support: 99 },
      { productId: 4, support: 99 },
      { productId: 1, support: 3 },
    ]);
    expect(result.get(4)).toEqual([
      { productId: 2, support: 99 },
      { productId: 3, support: 99 },
      { productId: 1, support: 3 },
    ]);
  });

  it('adheres to max related products', () => {
    const result = getRelatedProductsPerProduct(itemSets, 2);
    expect(result.get(1)).toEqual([
      { productId: 3, support: 3 },
      { productId: 4, support: 3 },
    ]);
  });
});
