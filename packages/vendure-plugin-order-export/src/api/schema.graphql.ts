import gql from 'graphql-tag';

export const schema = gql`
  type OrderExportStrategy {
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

  input OrderExportStrategyInput {
    name: ID!
    arguments: [OrderExportArgumentInput!]!
  }

  extend type Mutation {
    updateOrderExportStrategy(
      input: OrderExportStrategyInput!
    ): [OrderExportStrategy!]!
  }

  extend type Query {
    allOrderExportStrategies: [OrderExportStrategy!]!
  }
`;
