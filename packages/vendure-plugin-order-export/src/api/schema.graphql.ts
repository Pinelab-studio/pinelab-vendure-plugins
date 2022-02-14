import gql from 'graphql-tag';

export const schema = gql`
  #    scalar JSON
  #    scalar DateTime

  type ExportedOrder {
    id: ID!
    createdAt: DateTime
    updatedAt: DateTime
    orderId: String!
    """
    Reference to the external platform. For example the uuid of the exported order
    """
    reference: String
    """
    Free text field for additional messages
    """
    message: String
    """
    Field that will be shown as anchor in UI
    """
    externalLink: String
    """
    Indicates whether the order has been successfully exported or not
    """
    successful: Boolean!
    order: Order
  }

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

  input allExportedOrdersFilter {
    limit: Int
    successful: Boolean
  }

  extend type Mutation {
    updateOrderExportConfig(
      input: OrderExportConfigInput!
    ): [OrderExportConfig!]!
  }

  extend type Query {
    allOrderExportConfigs: [OrderExportConfig!]!
    allExportedOrders(filter: allExportedOrdersFilter): [ExportedOrder!]!
  }
`;
