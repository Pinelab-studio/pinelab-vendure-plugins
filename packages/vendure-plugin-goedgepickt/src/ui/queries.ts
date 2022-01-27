import gql from 'graphql-tag';

export const updateGoedgepicktConfig = gql`
  mutation updateGoedgepicktConfig($input: GoedgepicktConfigInput!) {
    updateGoedgepicktConfig(input: $input) {
      apiKey
      webshopUuid
      orderWebhookKey
      stockWebhookKey
    }
  }
`;

export const getGoedgepicktConfig = gql`
  query goedgepicktConfig {
    goedgepicktConfig {
      apiKey
      webshopUuid
      orderWebhookKey
      stockWebhookKey
    }
  }
`;

export const pushProductsToGoedgepickt = gql`
  mutation pushProductsToGoedgepickt {
    pushProductsToGoedgepickt
  }
`;
export const pullGoedgepicktStocklevels = gql`
  mutation pullGoedgepicktStocklevels {
    pullGoedgepicktStocklevels
  }
`;
