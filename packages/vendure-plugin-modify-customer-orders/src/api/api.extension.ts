import { gql } from 'graphql-tag';

export const adminApiExtension = gql`
  extend type Mutation {
    convertOrderToDraft(id: ID!): Order
  }
`;
