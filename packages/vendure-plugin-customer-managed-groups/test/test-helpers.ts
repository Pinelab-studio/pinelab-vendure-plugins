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
      customFields
      addresses {
        ...AddressFragment
      }
      isGroupAdministrator
    }
  }
`;

export const adminGetOrdersForCustomerManagedGroup = gql`
  query ordersForCustomerManagedGroup($customerManagedGroupId: ID!) {
    ordersForCustomerManagedGroup(
      customerManagedGroupId: $customerManagedGroupId
    ) {
      items {
        id
        code
        customer {
          emailAddress
        }
        payments {
          id
          transactionId
          state
          errorMessage
        }
        lines {
          id
          unitPriceWithTax
          linePriceWithTax
        }
        customFields {
          testing
        }
      }
      totalItems
    }
  }
`;

export const customers = gql`
  query customers($options: CustomerListOptions) {
    customers(options: $options) {
      items {
        id
        groups {
          id
          customFields {
            groupAdmins {
              id
            }
            isCustomerManaged
          }
        }
      }
    }
  }
`;

export const addCustomer = gql`
  mutation createCustomer($input: CreateCustomerInput!, $password: String) {
    createCustomer(input: $input, password: $password) {
      ... on Customer {
        id
        groups {
          id
          customFields {
            groupAdmins {
              id
            }
            isCustomerManaged
          }
        }
      }
      ... on ErrorResult {
        errorCode
      }
    }
  }
`;

export const adminGetCustomerGroupQuery = gql`
  query customerGroup($id: ID!) {
    customerGroup(id: $id) {
      id
      name
      customers {
        items {
          id
        }
      }
      customFields {
        groupAdmins {
          id
        }
        isCustomerManaged
      }
    }
  }
`;

export const adminCreateCustomerManagedGroupMutation = gql`
  ${customerManagedGroupFragment}
  mutation createCustomerManagedGroup($customerId: ID!) {
    createCustomerManagedGroup(customerId: $customerId) {
      ...CustomerManagedGroupFragment
    }
  }
`;

export const adminAddCustomersToGroupMutation = gql`
  mutation AddCustomersToGroup($customerGroupId: ID!, $customerIds: [ID!]!) {
    addCustomersToGroup(
      customerGroupId: $customerGroupId
      customerIds: $customerIds
    ) {
      id
      name
      customers {
        items {
          id
        }
      }
      customFields {
        groupAdmins {
          id
        }
        isCustomerManaged
      }
    }
  }
`;

export const adminMakeCustomerAdminOfGroupMutation = gql`
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

export const myCustomerManagedGroupQuery = gql`
  ${customerManagedGroupFragment}
  query myCustomerManagedGroup {
    myCustomerManagedGroup {
      ...CustomerManagedGroupFragment
    }
  }
`;

export const adminCustomerManagedGroupQuery = gql`
  query customerGroup($id: ID!) {
    customerGroup(id: $id) {
      id
      name
      customFields {
        groupAdmins {
          id
        }
        isCustomerManaged
      }
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

export const addCustomerToMyCustomerManagedGroupMutation = gql`
  mutation addCustomerToMyCustomerManagedGroup(
    $input: AddCustomerToMyCustomerManagedGroupInput!
  ) {
    addCustomerToMyCustomerManagedGroup(input: $input) {
      id
      name
      customers {
        customerId
        emailAddress
        isGroupAdministrator
      }
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
        payments {
          id
          transactionId
          state
          errorMessage
        }
        lines {
          id
          unitPriceWithTax
          linePriceWithTax
        }
        customFields {
          testing
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
