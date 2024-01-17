import { gql } from 'graphql-tag';
export const adminApiExtensions = gql`
  extend type Query {
    requiredFacets: [Facet!]!
  }
`;
