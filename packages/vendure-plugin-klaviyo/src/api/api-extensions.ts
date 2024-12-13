import { gql } from 'graphql-tag';

export const shopApiExtensions = gql`
  extend type Mutation {
    """
    This mutation indicates that a customer has started the checkout process.
    The frontend should call this mutation. It will make the Klaviyo plugin emit a CheckoutStartedEvent.
    """
    klaviyoCheckoutStarted: Boolean!
  }
`;
