import gql from 'graphql-tag';

export const shopApiExtensions = gql`
  type ActiveOrderValidationError {
    message: String!
    errorCode: String!
    relatedOrderLineIds: [ID!]
  }

  extend type Mutation {
    """
    Validate the active order. This will run all validation rules and return a list of errors if any.
    Returns empty array if no validation errors are found.

    This is a mutation, because it is valid to reserve stock, or transition the order to a custom state for example.
    """
    validateActiveOrder: [ActiveOrderValidationError!]!
  }
`;
