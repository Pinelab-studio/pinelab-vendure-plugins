import gql from 'graphql-tag';

export const schema = gql`
  input GoedgepicktConfigInput {
    apiKey: String
    webshopUuid: String
  }

  type GoedgepicktConfig {
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
  }

  extend type Query {
    goedgepicktConfig: GoedgepicktConfig
  }
`;
