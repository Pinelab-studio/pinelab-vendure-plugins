import { gql } from 'graphql-tag';
import { commonSchemaExtensions } from './common-graphql';

export const shopApiSchemaExtensions = gql`
  ${commonSchemaExtensions}

  extend type Mutation {
    createStripeSubscriptionIntent: StripeSubscriptionIntent!
  }
`;
