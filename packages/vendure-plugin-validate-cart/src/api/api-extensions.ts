import gql from 'graphql-tag';

export const shopApiExtensions = gql`
  type ActiveOrderValidationError {
    message: String!
    errorCode: String!
    relatedOrderLineIds: [ID!]
  }

  type ValidateActiveOrderResult {
    errors: [ActiveOrderValidationError!]!
    order: Order!
  }

  extend type Mutation {
    """
    Validate the active order. This will run all validation rules and return a list of errors if any.
    Returns an empty errors array if no validation errors are found. The active order is returned as well,
    so it can be used to display the latest state after validation, including any potential modifications
    made by a custom validation strategy.

    This is a mutation, because it is valid to reserve stock, or transition the order to a custom state for example.
    """
    validateActiveOrder: ValidateActiveOrderResult!
  }
`;

/**
 * These scalars are only declared to satisfy the codegen tool, which only sees this plugin's schema.
 * The Vendure runtime already defines the real `Order` type.
 */
export const scalars = gql`
  scalar Order
`;
