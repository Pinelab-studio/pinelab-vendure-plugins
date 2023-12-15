import { gql } from 'graphql-tag';
import { FACET_WITH_VALUES_FRAGMENT } from '@vendure/admin-ui/core';

export const GET_SHOW_ON_PRODUCT_DETAIL_FACETS = gql`
  query GetFacetDetail {
    showOnProductDetailFacets {
      ...FacetWithValues
    }
  }
  ${FACET_WITH_VALUES_FRAGMENT}
`;

export const GET_SHOW_ON_PRODUCT_DETAIL_FACETS_IF = gql`
  query GetFacetsDetail($facetValueIds: [ID!]!) {
    showOnProductDetailForFacets(facetValueIds: $facetValueIds) {
      ...FacetWithValues
    }
  }
  ${FACET_WITH_VALUES_FRAGMENT}
`;
