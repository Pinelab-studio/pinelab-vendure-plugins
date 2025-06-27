import { gql } from 'graphql-tag';

export const shopApiExtensions = gql`
  extend type Mutation {
    """
    This mutation indicates that a customer has started the checkout process.
    The frontend should call this mutation. It will make the Klaviyo plugin emit a CheckoutStartedEvent.
    """
    klaviyoCheckoutStarted: Boolean!
    """
    Subscribe an email address to a Klaviyo list.
    Klaviyo also sends a confirmation before the subscription is active (double opt-in).
    """
    subscribeToKlaviyoList(emailAddress: String!, listId: String!): Boolean!
    """
    Subscribe an email address for back in stock notifications for a given product.
    'catalogItemId' is the id of the product or product variant in the Klaviyo catalog. This depends on your feed setup.
    If you use the built-in 'klaviyoProductFeed' query, you should use the product variant id.
    This back in stock assumes you use a single Klaviyo feed, as it uses $default to identify the feed.
    """
    subscribeToKlaviyoBackInStock(
      emailAddress: String!
      catalogItemId: String!
    ): Boolean!
  }
  extend type Query {
    """
    Get the Klaviyo JSON product feed. Each product variant is an entry in the feed.
    For some basic protection, we ask for a password. The feed disabled when no password is configured.
    """
    klaviyoProductFeed(password: String!): String!
  }
`;
