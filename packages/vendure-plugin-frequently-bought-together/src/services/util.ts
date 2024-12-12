import { ID } from '@vendure/core';
import { Itemset } from 'node-fpgrowth';
import { Support } from '../types';

/**
 * Construct a map of related products with support per product based on the item sets.
 */
export function getRelatedProductsPerProduct(
  itemSets: Itemset<ID>[]
): Map<ID, Support[]> {
  // Sort lowest to highest support
  itemSets.sort((a, b) => b.support - a.support);
  const relatedProductsPerProduct = new Map<ID, Support[]>();
  for (const itemSet of itemSets) {
    for (const productId of itemSet.items) {
      const relations = relatedProductsPerProduct.get(productId) || [];
      itemSet.items.forEach((itemId) => {
        const alreadyHasProduct = relations.some((r) => r.productId === itemId);
        if (itemId !== productId && !alreadyHasProduct) {
          relations.push({ productId: itemId, support: itemSet.support });
        }
      });
      relatedProductsPerProduct.set(productId, relations);
    }
  }
  return relatedProductsPerProduct;
}
