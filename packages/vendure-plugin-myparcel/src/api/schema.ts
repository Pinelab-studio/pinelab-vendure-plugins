import gql from 'graphql-tag';

export const schema = gql`
  input MyparcelConfigInput {
    apiKey: String
  }
  type MyparcelConfig {
    apiKey: String
  }
  extend type Mutation {
    updateMyparcelConfig(input: MyparcelConfigInput!): MyparcelConfig
  }

  extend type Query {
    myparcelConfig: MyparcelConfig
  }
`;
