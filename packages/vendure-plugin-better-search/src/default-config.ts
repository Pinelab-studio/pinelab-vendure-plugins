import { Collection, Product } from '@vendure/core';
import { BetterSearchConfig } from './types';
import { BetterSearchResult } from './';

type IndexedFields = BetterSearchResult & {
  variantNames: string[];
  skus: string[];
};

export const defaultSearchConfig: BetterSearchConfig<IndexedFields> = {
  debounceIndexRebuildMs: 5000,
  fuzziness: 0.3,
  indexableFields: {
    productName: { weight: 3 },
    slug: { weight: 2 },
    variantNames: { weight: 3 },
    collectionNames: { weight: 1 },
    skus: { weight: 2 },
  },
  mapToSearchDocument: mapToDefaultSearchDocument,
};

/**
 * The default mapping of product and collections to a search document.
 */
function mapToDefaultSearchDocument(
  product: Product,
  collectionForThisProduct: Collection[]
): IndexedFields {
  const highestPrice = Math.max(...product.variants.map((v) => v.price));
  const highestPriceWithTax = Math.max(
    ...product.variants.map((v) => v.priceWithTax)
  );
  const lowestPrice = Math.min(...product.variants.map((v) => v.price));
  const lowestPriceWithTax = Math.min(
    ...product.variants.map((v) => v.priceWithTax)
  );

  const variantFacetValueIds = product.variants.flatMap((v) =>
    v.facetValues.map((fv) => fv.id)
  );
  const productFacetValueIds = product.facetValues.map((fv) => fv.id);
  return {
    collectionIds: collectionForThisProduct.map((c) => c.id),
    collectionNames: collectionForThisProduct.map((c) => c.name),
    facetValueIds: [
      // Make unique
      ...new Set([...variantFacetValueIds, ...productFacetValueIds]),
    ],
    highestPrice,
    highestPriceWithTax,
    lowestPrice,
    lowestPriceWithTax,
    productAsset: product.featuredAsset,
    productId: product.id,
    productName: product.name,
    slug: product.slug,
    variantNames: product.variants.map((v) => v.name),
    skus: product.variants.map((v) => v.sku),
  };
}
