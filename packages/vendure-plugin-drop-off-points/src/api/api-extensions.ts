import gql from 'graphql-tag';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Just to support static type generation
const _scalar = gql`
  scalar Order
  scalar JSON
`;

export const shopApiExtensions = gql`
  input ParcelDropOffPointSearchInput {
    """
    Specify the carrier to search for. E.g. PostNL, DHL etc
    """
    carrier: String!
    postalCode: String!
    houseNumber: String
  }

  type ParcelDropOffPoint {
    token: ID!
    """
    The carrier assigned ID of the drop off point
    """
    dropOffPointId: String!
    name: String!
    streetLine1: String!
    streetLine2: String
    postalCode: String!
    houseNumber: String!
    houseNumberSuffix: String
    city: String!
    country: String!
    latitude: Float
    longitude: Float
    distanceInKm: Float
    cutOffTime: String
    additionalData: JSON
  }

  extend type Query {
    parcelDropOffPoints(
      input: ParcelDropOffPointSearchInput!
    ): [ParcelDropOffPoint!]!
    setDropOffPoints(token: ID!): Order!
    unsetDropOffPoints: Order!
  }
`;
