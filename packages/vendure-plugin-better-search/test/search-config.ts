import {
  BetterSearchResult,
  defaultSearchConfig,
  BetterSearchOptions,
} from '../src';

interface MySearchResult extends BetterSearchResult {
  facetValueNames: string[];
  customStaticField: string;
}
export const searchConfig: BetterSearchOptions<MySearchResult> = {
  mapToSearchDocument: (product, collections) => {
    const defaultDocument = defaultSearchConfig.mapToSearchDocument(
      product,
      collections
    );
    const productFacetValues = product.facetValues.map((fv) => fv.name);
    return {
      ...defaultDocument,
      facetValueNames: productFacetValues,
      productAsset: {
        id: 'mock',
        preview: 'mock-preview',
      },
      customStaticField: 'Some test value',
    };
  },
  // Add facetValueNames to indexable fields
  indexableFields: {
    ...defaultSearchConfig.indexableFields,
    facetValueNames: { weight: 2, graphqlFieldType: '[String!]!' },
    customStaticField: { weight: 0, graphqlFieldType: 'String!' },
  },
};
