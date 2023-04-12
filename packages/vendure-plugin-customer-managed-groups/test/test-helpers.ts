import { gql } from 'graphql-tag';

export const addressFragment = gql`
  fragment AddressFragment on CustomerManagedGroupAddress {
    id
    createdAt
    updatedAt
    fullName
    company
    streetLine1
    streetLine2
    city
    province
    postalCode
    country {
      code
    }
    phoneNumber
    defaultShippingAddress
    defaultBillingAddress
  }
`;

export const customerManagedGroupFragment = gql`
  ${addressFragment}
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
      addresses {
        ...AddressFragment
      }
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

export const activeCustomerManagedGroupMemberQuery = gql`
  query activeCustomerManagedGroupMember {
    activeCustomerManagedGroupMember {
      customerId
      title
      firstName
      lastName
      emailAddress
      isGroupAdministrator
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

export const updateCustomerManagedGroupMemberMutation = gql`
  ${customerManagedGroupFragment}
  mutation updateCustomerManagedGroupMember(
    $input: UpdateCustomerManagedGroupMemberInput!
  ) {
    updateCustomerManagedGroupMember(input: $input) {
      ...CustomerManagedGroupFragment
    }
  }
`;

export const makeCustomerAdminOfCustomerManagedGroupMutation = gql`
  ${customerManagedGroupFragment}
  mutation makeCustomerAdminOfCustomerManagedGroup(
    $groupId: ID!
    $customerId: ID!
  ) {
    makeCustomerAdminOfCustomerManagedGroup(
      groupId: $groupId
      customerId: $customerId
    ) {
      ...CustomerManagedGroupFragment
    }
  }
`;
