import gql from 'graphql-tag';

export const adminSchema = gql`
  input WebhookInput {
    event: String!
    url: String!
    transformerName: String
  }

  type Webhook {
    id: ID!
    event: String!
    url: String!
    requestTransformer: WebhookRequestTransformer
  }

  type WebhookRequestTransformer {
    name: String!
    supportedEvents: [String!]!
  }

  extend type Mutation {
    """
    Set all webhooks for the current channel. This will overwrite any existing webhooks.
    """
    setWebhooks(webhooks: [WebhookInput!]!): [Webhook!]!
  }

  extend type Query {
    """
    Get all webhooks for the current channel
    """
    webhooks: [Webhook!]!
    """
    Get all available Vendure events that can be used to trigger webhooks
    """
    availableWebhookEvents: [String!]!
    """
    "
    Get all available webhook request transformers
    """
    availableWebhookRequestTransformers: [WebhookRequestTransformer!]!
  }
`;
