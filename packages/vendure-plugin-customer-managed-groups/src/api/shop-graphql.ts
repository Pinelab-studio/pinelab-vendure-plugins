import { gql } from 'graphql-tag';
import { commonSchema } from './common-graphql';

export const shopSchema = gql`
  ${commonSchema}

  input AddCustomerToMyCustomerManagedGroupInput {
    emailAddress: String!
    isGroupAdmin: Boolean
  }

  input UpdateCustomerManagedGroupMemberInput {
    title: String
    firstName: String
    lastName: String
    emailAddress: String
    addresses: [CustomerManagedGroupAddressInput!]
    customerId: ID!
    customFields: JSON
  }

  """
  When no ID is given, a new address will be created
  """
  input CustomerManagedGroupAddressInput {
    id: ID
    fullName: String
    company: String
    streetLine1: String
    streetLine2: String
    city: String
    province: String
    postalCode: String
    countryCode: String
    phoneNumber: String
    defaultShippingAddress: Boolean
    defaultBillingAddress: Boolean
  }

  extend type Mutation {
    """
    Creates a group with the current logged in user as administrator of the group
    """
    addCustomerToMyCustomerManagedGroup(
      input: AddCustomerToMyCustomerManagedGroupInput
    ): CustomerManagedGroup!

    """
    Create an empty group with the current user as Administrator
    """
    createCustomerManagedGroup: CustomerManagedGroup!

    removeCustomerFromMyCustomerManagedGroup(
      customerId: ID!
    ): CustomerManagedGroup!

    """
    Update a member of one's group
    """
    updateCustomerManagedGroupMember(
      input: UpdateCustomerManagedGroupMemberInput!
    ): CustomerManagedGroup!
  }

  extend type Query {
    """
    Fetch placed orders for each member of the group
    """
    ordersForMyCustomerManagedGroup: OrderList!

    """
    Fetch the current logged in group member
    """
    activeCustomerManagedGroupMember: CustomerManagedGroupMember

    myCustomerManagedGroup: CustomerManagedGroup
  }
`;
