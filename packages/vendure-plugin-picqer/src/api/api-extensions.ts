import { gql } from 'graphql-tag';

export const adminSchema = gql`
  input PicqerConfigInput {
    enabled: Boolean
    apiKey: String
    apiEndpoint: String
    storefrontUrl: String
    supportEmail: String
  }

  input TestPicqerInput {
    apiKey: String!
    apiEndpoint: String!
    storefrontUrl: String!
    supportEmail: String!
  }

  type PicqerConfig {
    enabled: Boolean
    apiKey: String
    apiEndpoint: String
    storefrontUrl: String
    supportEmail: String
  }

  extend type Query {
    picqerConfig: PicqerConfig
    """
    Test Picqer config against the Picqer API
    """
    isPicqerConfigValid(input: TestPicqerInput!): Boolean!
  }

  extend type Mutation {
    """
    Push all products to, and pull all stock levels from Picqer
    """
    triggerPicqerFullSync: Boolean!
    """
    Upsert Picqer config for the current channel
    """
    upsertPicqerConfig(input: PicqerConfigInput!): PicqerConfig!
  }
`;
