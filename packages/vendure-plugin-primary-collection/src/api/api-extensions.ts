import { gql } from 'graphql-tag';
export const apiExtensions = gql`
  extend type Product {
    primaryCollection: Collection
    breadcrumbs: ProductBreadcrumb
  }

  type ProductBreadcrumb {
    id: ID!
    name: String!
    slug: String!
  }

  extend type Collection {
    channels: [Channel!]!
  }
`;
