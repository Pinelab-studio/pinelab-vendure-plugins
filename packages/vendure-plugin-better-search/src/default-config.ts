import { BetterSearchResult } from './api/generated/graphql';
import { Collection, Product } from '@vendure/core';
import { PluginInitOptions } from './types';

type IndexedFields = BetterSearchResult & {
  variantNames: string[];
  skus: string[];
};

export const defaultSearchConfig: PluginInitOptions = {
  fuzziness: 0.4,
  indexableFields: {
    name: 3,
    slug: 2,
    variantNames: 3,
    collectionNames: 1,
    skus: 2,
  },
  mapToSearchDocument: (
    product: Product,
    collectionForThisProduct: Collection[]
  ): IndexedFields => {
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
        ...new Set([...variantFacetValueIds, ...productFacetValueIds]),
      ], // Make unique
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
  },
};
