import { gql } from 'graphql-tag';

export const apiExtensions = {
  schema: gql`
    extend type Query {
      productVariantsWithLowStock: [ProductVariant!]!
    }
  `,
};
