import gql from 'graphql-tag';

export const schema = gql`
  extend enum HistoryEntryType {
    GOEDGEPICKT_NOTIFICATION
  }

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
    orderWebhookKey: String
    stockWebhookUrl: String
    stockWebhookKey: String
  }

  type GoedgepicktError {
    message: String
  }

  union GoedgepicktConfigUpdateResult = GoedgepicktConfig | GoedgepicktError

  extend type Mutation {
    updateGoedgepicktConfig(
      input: GoedgepicktConfigInput!
    ): GoedgepicktConfigUpdateResult
    # Push products and pull stocklevels
    runGoedgepicktFullSync: Boolean
    syncOrderToGoedgepickt(orderCode: String!): Boolean
  }

  extend type Query {
    goedgepicktConfig: GoedgepicktConfig
  }
`;
