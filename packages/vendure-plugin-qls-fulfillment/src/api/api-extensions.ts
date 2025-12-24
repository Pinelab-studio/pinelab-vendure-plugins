import gql from 'graphql-tag';

export const adminApiExtensions = gql`
  extend type Mutation {
    """
    Trigger a sync to create or update all products in Vendure to QLS, and pull in stock levels from QLS.
    """
    triggerQlsProductSync: Boolean!

    """
    Manually push an order to QLS (again)
    """
    pushOrderToQls(orderId: ID!): String!
  }
`;

export const shopApiExtensions = gql`
  type QlsServicePoint {
    servicepoint_code: String!
    name: String!
    address: QlsServicePointAddress!
    geo: QlsServicePointGeo!
    times: [QlsServicePointTime!]!
    needsPostNumber: Boolean!
    productId: Int!
    productName: String!
  }

  type QlsServicePointAddress {
    country: String!
    postalcode: String!
    locality: String!
    street: String!
    housenumber: String!
  }

  type QlsServicePointGeo {
    lat: Float!
    long: Float!
  }

  type QlsServicePointTime {
    weekday: Int!
    formatted: String!
    from: String!
    to: String!
  }

  input QlsServicePointSearchInput {
    countryCode: String!
    postalCode: String!
  }

  extend type Query {
    """
    Get the service points for a given postal code
    """
    qlsServicePoints(input: QlsServicePointSearchInput!): [QlsServicePoint!]!
  }
`;
