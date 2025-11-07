import gql from 'graphql-tag';

export const adminApiExtensions = gql`
  extend type Mutation {
    """
    Trigger a sync to send all products in Vendure to QLS.
    """
    triggerQlsProductSync: Boolean!
  }
`;
