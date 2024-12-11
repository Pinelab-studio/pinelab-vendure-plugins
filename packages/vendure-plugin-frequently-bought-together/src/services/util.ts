import { ID } from '@vendure/core';
import { Itemset } from 'node-fpgrowth';

/**
 * Construct a map of related products per product based on the item sets.
 *
 * E.g. [1,2] will add the relations for product 1 to [2] and for product 2 to [1]
 */
export function getRelatedProductsPerProduct(
  itemSets: Itemset<ID>[]
): Map<ID, ID[]> {
  // Sort lowest to highest support
  itemSets.sort((a, b) => b.support - a.support);
  const relatedProductsPerProduct = new Map<ID, Set<ID>>();
  for (const itemSet of itemSets) {
    for (const productId of itemSet.items) {
      const relations =
        relatedProductsPerProduct.get(productId) || new Set<ID>();
      itemSet.items.forEach((id) => {
        if (id !== productId) {
          // Only add if not self
          relations.add(id);
        }
      });
      relatedProductsPerProduct.set(productId, relations);
    }
  }
  return new Map(
    Array.from(relatedProductsPerProduct.entries()).map(
      ([productId, relations]) => [productId, Array.from(relations)]
    )
  );
}
