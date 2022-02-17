import gql from 'graphql-tag';

export const schema = gql`
  #scalar DateTime

  type Invoice {
    id: ID!
    createdAt: DateTime
    updatedAt: DateTime
    orderCode: String
    orderId: String
    customerEmail: String
    downloadUrl: String
  }
`;
