import { gql } from 'graphql-tag';
export const apiExtensions = gql`
  extend type Product {
    primaryCollection: Collection
  }

  extend type Collection {
    channels: [Channel!]!
  }
`;
