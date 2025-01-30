import gql from 'graphql-tag';

// Just to support static type generation
const _scalar = gql`
  scalar Order
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
    city: String!
    country: String!
    latitude: Float
    longitude: Float
    distanceInKm: Float
    cutOffTime: String
  }

  extend type Query {
    parcelDropOffPoints(
      input: ParcelDropOffPointSearchInput
    ): [ParcelDropOffPoint]!
    setDropOffPoints(id: ID!): Order!
    unsetDropOffPoints: Order!
  }

  # JWT encoded ID's will be long if they contain address. It adds 0.4kb per point in the resultset. Acceptable?
  # Do we need more filters? e.g. shoptype=packStation. These would differ per carrier though

  # eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgwMDQtTkwtMzU0MjUyIiwibmFtZSI6IlBha2tldGF1dG9tYWF0IERITCBCaW5uZW4iLCJhZGRyZXNzIjp7ImNvdW50cnlDb2RlIjoiTkwiLCJ6aXBDb2RlIjoiMzU0MkFEIiwiY2l0eSI6IlV0cmVjaHQiLCJzdHJlZXQiOiJSZWFjdG9yd2VnIiwibnVtYmVyIjoiMjUiLCJhZGRpdGlvbiI6Ii1QUy80MSIsInBvc3RhbENvZGUiOiIzNTQyQUQifSwiaWF0IjoxNzM4MDc5Mjg4fQ.LKAXT7HaMrR3NMHmBhpS2sqXbkj3M_4rXwNZunNbeJs
`;
