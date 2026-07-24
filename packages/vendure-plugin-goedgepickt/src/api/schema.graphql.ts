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

  extend type Mutation {
    updateGoedgepicktConfig(
      input: GoedgepicktConfigInput!
    ): GoedgepicktConfigUpdateResult
    syncOrderToGoedgepickt(orderCode: String!): Boolean
  }

  extend type Query {
    goedgepicktConfig: GoedgepicktConfig
  }
`;
