import { gql } from 'graphql-tag';
export const adminApiExtensions = gql`
  extend type Query {
    showOnProductDetailFacets: [Facet]
    showOnProductDetailForFacets(facetValueIds: [ID!]!): [Facet]
  }
`;
