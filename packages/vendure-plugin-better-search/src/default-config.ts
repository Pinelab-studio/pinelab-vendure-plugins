import { Collection, Product } from '@vendure/core';
import { PluginInitOptions, SearchDocument } from './types';

type IndexedFields = SearchDocument & {
  variantNames: string[];
  skus: string[];
};

export const defaultSearchConfig: PluginInitOptions = {
  debounceIndexRebuildMs: 5000,
  fuzziness: 0.3,
  indexableFields: {
    productName: 3,
    slug: 2,
    variantNames: 3,
    collectionNames: 1,
    skus: 2,
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
