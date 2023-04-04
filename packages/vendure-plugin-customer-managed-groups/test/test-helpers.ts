import { gql } from 'graphql-tag';

export const customerManagedGroupFragment = gql`
  fragment CustomerManagedGroupFragment on CustomerManagedGroup {
    id
    createdAt
    updatedAt
    name
    customers {
      customerId
      title
      firstName
      lastName
      emailAddress
      isGroupAdministrator
    }
  }
`;

export const addCustomerToGroupMutation = gql`
  ${customerManagedGroupFragment}
  mutation AddCustomerToGroup(
    $input: AddCustomerToMyCustomerManagedGroupInput!
  ) {
    addCustomerToMyCustomerManagedGroup(input: $input) {
      ...CustomerManagedGroupFragment
    }
  }
`;

export const myCustomerManagedGroupQuery = gql`
  ${customerManagedGroupFragment}
  query myCustomerManagedGroup {
    myCustomerManagedGroup {
      ...CustomerManagedGroupFragment
    }
  }
`;

export const removeCustomerFromGroupMutation = gql`
  ${customerManagedGroupFragment}
  mutation RemoveCustomerFromGroup($customerId: ID!) {
    removeCustomerFromMyCustomerManagedGroup(customerId: $customerId) {
      ...CustomerManagedGroupFragment
    }
  }
`;

export const createCustomerManagedGroupMutation = gql`
  ${customerManagedGroupFragment}
  mutation createCustomerManagedGroup {
    createCustomerManagedGroup {
      ...CustomerManagedGroupFragment
    }
  }
`;

export const getOrdersForMyCustomerManagedGroup = gql`
  query {
    ordersForMyCustomerManagedGroup {
      items {
        id
        code
        customer {
          emailAddress
        }
      }
      totalItems
    }
  }
`;
