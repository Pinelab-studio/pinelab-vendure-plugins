import gql from 'graphql-tag';

// FIXME do not redefine search query, only expand result type here

export const adminApiExtensions = gql`
  extend type Query {
    inspectSearchIndex(skip: Int, take: Int): JSON!
  }
`;
