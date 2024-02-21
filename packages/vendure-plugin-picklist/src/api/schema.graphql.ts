import gql from 'graphql-tag';

export const schema = gql`
  type PicklistConfig {
    id: ID!
    templateString: String
  }

  extend type Mutation {
    upsertPicklistConfig(templateString: String!): PicklistConfig!
  }

  extend type Query {
    picklistConfig: PicklistConfig
  }
`;
