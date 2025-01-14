import { gql } from 'graphql-tag';

export const shopApiExtensions = gql`
  extend type Mutation {
    """
    This mutation indicates that a customer has started the checkout process.
    The frontend should call this mutation. It will make the Klaviyo plugin emit a CheckoutStartedEvent.
    """
    klaviyoCheckoutStarted: Boolean!
    """
    Subscribe an email address to a Klaviyo list. Requires Permission.Authenticated to prevent bot usage.
    Klaviyo also sends a confirmation before the subscription is active (double opt-in).
    """
    subscribeToKlaviyoList(emailAddress: String!, listId: String!): Boolean!
  }
`;
