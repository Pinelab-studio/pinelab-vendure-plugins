import gql from 'graphql-tag';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Only used by graphql codegen
const _scalars = gql`
  scalar OrderAddress
`;

export const shopApiExtensions = gql`
  input AddressLookupInput {
    postalCode: String!
    houseNumber: String
    streetName: String
  }

  extend type Query {
    lookupAddress(input: AddressLookupInput!): [OrderAddress!]!
  }
`;
