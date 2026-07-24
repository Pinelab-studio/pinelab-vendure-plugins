import gql from 'graphql-tag';

/**
 * Just to satisfy graphql codegen
 */
const scalars = gql`
  scalar JSON
`;

export const adminApiExtensions = gql`
  extend type Query {
    inspectSearchIndex(skip: Int, take: Int): JSON!
  }
`;

export const shopApiExtensions = gql`
  type SearchSuggestion {
    suggestion: String!
  }

  extend type Query {
    searchSuggestions(term: String!): [SearchSuggestion!]!
  }
`;
