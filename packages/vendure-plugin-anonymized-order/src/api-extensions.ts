import { gql } from 'graphql-tag';

const scalars = gql`
  scalar Order
`;
export const anonymizeOrderShopSchema = gql`
  extend type Query {
    anonymizedOrder(orderCode: String!, emailAddress: String!): Order
  }
`;
