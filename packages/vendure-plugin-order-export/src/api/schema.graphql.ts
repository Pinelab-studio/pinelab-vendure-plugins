import gql from 'graphql-tag';

export const schema = gql`
  type OrderExportResult {
    id: ID!
    createdAt: DateTime
    updatedAt: DateTime
    orderPlacedAt: DateTime
    orderId: String!
    orderCode: String!
    customerEmail: String
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
    successful: Boolean
  }

  type OrderExportResultList {
    items: [OrderExportResult!]!
    totalItems: Int!
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

  input OrderExportResultFilter {
    page: Int!
    itemsPerPage: Int!
  }

  extend type Mutation {
    updateOrderExportConfig(
      input: OrderExportConfigInput!
    ): [OrderExportConfig!]!
  }

  extend type Query {
    orderExportConfigs: [OrderExportConfig!]!
    orderExportResults(filter: OrderExportResultFilter!): OrderExportResultList!
  }
`;
