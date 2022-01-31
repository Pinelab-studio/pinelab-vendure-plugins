import gql from 'graphql-tag';

export const updateGoedgepicktConfig = gql`
  mutation updateGoedgepicktConfig($input: GoedgepicktConfigInput!) {
    updateGoedgepicktConfig(input: $input) {
      ... on GoedgepicktConfig {
        apiKey
        webshopUuid
        orderWebhookKey
        orderWebhookUrl
        stockWebhookKey
        stockWebhookUrl
      }
      ... on GoedgepicktError {
        message
      }
    }
  }
`;

export const getGoedgepicktConfig = gql`
  query goedgepicktConfig {
    goedgepicktConfig {
      apiKey
      webshopUuid
      orderWebhookKey
      orderWebhookUrl
      stockWebhookKey
      stockWebhookUrl
    }
  }
`;

export const runGoedgepicktFullSync = gql`
  mutation runGoedgepicktFullSync {
    runGoedgepicktFullSync
  }
`;
