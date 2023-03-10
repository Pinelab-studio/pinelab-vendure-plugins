import { gql } from 'graphql-tag';

export const shopSchema = gql`
  extend type Query {
    exampleQuery: String!
  }
`;
