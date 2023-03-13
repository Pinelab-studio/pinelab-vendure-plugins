import { gql } from 'graphql-tag';

export const customerManagedGroupFragment = gql`
  fragment CustomerManagedGroupFragment on CustomerManagedGroup {
    id
    createdAt
    updatedAt
    name
    administrators {
      id
      title
      firstName
      lastName
      emailAddress
    }
    participants {
      id
      title
      firstName
      lastName
      emailAddress
    }
  }
`;

export const addCustomerToGroupMutation = gql`
  ${customerManagedGroupFragment}
  mutation AddCustomerToGroup($emailAddress: String!) {
    addCustomerToMyCustomerManagedGroup(emailAddress: $emailAddress) {
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
