import gql from 'graphql-tag';

export const schema = gql`
  type OrderExportConfig {
    name: ID!
    arguments: [OrderExportArgument!]!
  }

  type OrderExportArgument {
    name: String!
    value: String
  }

  input OrderExportArgumentInput {
    name: String!
    value: String
  }

  input OrderExportConfigInput {
    name: String!
    arguments: [OrderExportArgumentInput!]!
  }

  extend type Mutation {
    updateOrderExportConfig(
      input: OrderExportConfigInput!
    ): [OrderExportConfig!]!
  }

  extend type Query {
    allOrderExportConfigs: [OrderExportConfig!]!
  }
`;
