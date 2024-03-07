import { gql } from 'graphql-tag';
import { commonSchema } from './common-graphql';

export const adminSchema = gql`
  ${commonSchema}

  extend type Mutation {
    """
    Create an empty group with the specified customer as Administrator
    """
    createCustomerManagedGroup(customerId: ID!): CustomerManagedGroup!
  }

  extend type Query {
    ordersForCustomerManagedGroup(customerManagedGroupId: ID!): OrderList!
  }
`;
