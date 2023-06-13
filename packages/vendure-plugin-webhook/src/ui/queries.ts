import gql from 'graphql-tag';

export const setWebhooksMutation = gql`
  mutation setWebhooks($webhooks: [WebhookInput!]!) {
    setWebhooks(webhooks: $webhooks) {
      id
      event
      requestTransformer {
        name
        supportedEvents
      }
      url
    }
  }
`;

export const getWebhooksQuery = gql`
  query webhooks {
    webhooks {
      id
      event
      requestTransformer {
        name
        supportedEvents
      }
      url
    }
  }
`;

export const getAvailableWebhookEventsQuery = gql`
  query availableWebhookEvents {
    availableWebhookEvents
  }
`;

export const getAvailableWebhookRequestTransformersQuery = gql`
  query availableWebhookRequestTransformers {
    availableWebhookRequestTransformers {
      name
      supportedEvents
    }
  }
`;
