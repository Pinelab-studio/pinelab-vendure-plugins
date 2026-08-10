import { gql } from 'graphql-tag';

export const adminSchema = gql`
  extend type Mutation {
    """
    Push all products to, and pull all stock levels from Picqer
    """
    triggerPicqerFullSync: Boolean!
  }
`;
