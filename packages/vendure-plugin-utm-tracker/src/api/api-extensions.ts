import gql from 'graphql-tag';

export const shopApiExtensions = gql`
  input UTMParameterInput {
    connectedAt: DateTime!
    source: String
    medium: String
    campaign: String
    term: String
    content: String
  }
  extend type Mutation {
    """
    Add UTM parameters to the active order. Throws an error if no active order is found.
    """
    addUTMParametersToOrder(inputs: [UTMParameterInput!]!): Boolean!
  }
`;

export const adminApiExtensions = gql`
  type UtmOrderParameter {
    id: ID!
    campaignDisplayName: String
    createdAt: DateTime!
    updatedAt: DateTime!
    connectedAt: DateTime!
    utmSource: String
    utmMedium: String
    utmCampaign: String
    utmTerm: String
    utmContent: String
    attributedPercentage: Float
    attributedValue: Money
  }

  extend type Order {
    utmParameters: [UtmOrderParameter!]!
  }
`;
