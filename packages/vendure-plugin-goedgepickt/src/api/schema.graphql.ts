import gql from 'graphql-tag';

export const schema = gql`
  input GoedgepicktConfigInput {
    enabled: Boolean
    apiKey: String
    webshopUuid: String
  }

  type GoedgepicktConfig {
    enabled: Boolean
    apiKey: String
    webshopUuid: String
    orderWebhookUrl: String
    stockWebhookUrl: String
  }

  type GoedgepicktError {
    message: String
  }

  union GoedgepicktConfigUpdateResult = GoedgepicktConfig | GoedgepicktError

  type GoedgepicktPullStockError {
    sku: String!
    message: String!
  }

  type GoedgepicktPullStockResult {
    success: Boolean!
    updatedVariants: Int!
    errors: [GoedgepicktPullStockError!]!
  }

  extend type Mutation {
    updateGoedgepicktConfig(
      input: GoedgepicktConfigInput!
    ): GoedgepicktConfigUpdateResult
    syncOrderToGoedgepickt(orderCode: String!): Boolean
    pullGoedgepicktStock(productId: ID!): GoedgepicktPullStockResult!
  }

  extend type Query {
    goedgepicktConfig: GoedgepicktConfig
  }
`;
