import { gql } from 'graphql-tag';

export const adminApiExtensions = gql`
  extend type Mutation {
    setCustomerForOrder(
      orderId: ID!
      customerId: ID
      input: CreateCustomerInput
    ): Order!
  }
`;
