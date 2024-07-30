import gql from 'graphql-tag';
// This is only used by codegen so it knows DateTime is a custom scalar

export const shopSchemaExtensions = gql`
  
  extend type Product {
    maxQuantityPerOrder: Int
    limitPurchasePerMultipleOf: Int
  }
`;
