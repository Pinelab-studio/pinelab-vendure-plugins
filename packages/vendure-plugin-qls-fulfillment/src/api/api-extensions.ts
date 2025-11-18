import gql from 'graphql-tag';

export const adminApiExtensions = gql`
  extend type Mutation {
    """
    Trigger a sync to create or update all products in Vendure to QLS, and pull in stock levels from QLS.
    """
    triggerQlsProductSync: Boolean!

    
  }
`;
