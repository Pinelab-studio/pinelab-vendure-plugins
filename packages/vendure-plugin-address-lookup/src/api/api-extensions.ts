import gql from 'graphql-tag';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Only used by graphql codegen
const _scalars = gql`
  scalar OrderAddress
  scalar ErrorResult
  scalar ErrorCode
`;

export const shopApiExtensions = gql`
  input AddressLookupInput {
    countryCode: String!
    postalCode: String
    houseNumber: String
    streetName: String
  }

  extend type Query {
    lookupAddress(input: AddressLookupInput!): [OrderAddress!]!
  }
`;

gql`
  # dit gaat goed, geen changes nodig
  query lookupAddress($input: AddressLookupInput!) {
    lookupAddress(input: $input) {
      streetLine1
      streetLine2
    }
  }

  # dit gaat niet goed, want postalCode is nu optional: String ipv String!
  query lookupAddress($postalCode: String!) {
    lookupAddress(input: { countryCode: "DE", postalCode: $postalCode }) {
      streetLine1
      streetLine2
    }
  }
`;
