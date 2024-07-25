import gql from 'graphql-tag';

const xeroAdminApiExtensions = gql`
  extend type Mutation {
    sendOrdersToXero(orderIds: [ID!]!): Boolean!
  }
`;

export const adminApiExtensions = gql`
  ${xeroAdminApiExtensions}
`;
