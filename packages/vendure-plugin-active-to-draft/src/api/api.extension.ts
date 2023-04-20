import { gql } from 'graphql-tag';
/* eslint no-use-before-define: 0 */

export const adminApiExtension = gql`
  extend type Mutation {
    convertToDraft(id: ID): Order
  }
`;
