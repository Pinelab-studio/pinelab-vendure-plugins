import { gql } from 'graphql-tag';
import { commonSchemaExtensions } from './common-graphql';

export const adminApiSchemaExtensions = gql`
  ${commonSchemaExtensions}

  extend type Mutation {
    createStripeSubscriptionIntent(orderId: ID!): StripeSubscriptionIntent!
  }
`;
