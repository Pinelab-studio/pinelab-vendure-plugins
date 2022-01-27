import gql from 'graphql-tag';

export const schema = gql`
  input GoedgepicktConfigInput {
    apiKey: String
    webshopUuid: String
  }
  type GoedgepicktConfig {
    apiKey: String
    webshopUuid: String
    orderWebhookKey: String
    stockWebhookKey: String
  }
  extend type Mutation {
    updateGoedgepicktConfig(input: GoedgepicktConfigInput!): GoedgepicktConfig
    pushProductsToGoedgepickt: Boolean
    pullGoedgepicktStocklevels: Boolean
  }

  extend type Query {
    goedgepicktConfig: GoedgepicktConfig
  }
`;
