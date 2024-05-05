import { gql } from 'graphql-tag';

// This is just to enable static codegen, without starting a server
const scalars = gql`
  scalar DateTime
  scalar OrderList
  scalar LanguageCode
  scalar JSON
`;

export const commonSchema = gql`
  type CustomerManagedGroupMember {
    customerId: ID!
    title: String
    addresses: [CustomerManagedGroupAddress!]
    firstName: String!
    lastName: String!
    emailAddress: String!
    isGroupAdministrator: Boolean!
    customFields: JSON
  }

  type CustomerManagedGroupAddress {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    fullName: String
    company: String
    streetLine1: String!
    streetLine2: String
    city: String
    province: String
    postalCode: String
    country: CustomerManagedGroupCountry!
    phoneNumber: String
    defaultShippingAddress: Boolean
    defaultBillingAddress: Boolean
  }

  type CustomerManagedGroupCountry {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    code: String!
    name: String!
    enabled: Boolean!
    translations: [CustomerManagedGroupCountryTranslation!]!
  }

  type CustomerManagedGroupCountryTranslation {
    id: ID!
    languageCode: LanguageCode!
    name: String!
  }

  type CustomerManagedGroup {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    name: String!
    customers: [CustomerManagedGroupMember!]!
  }

  extend type Mutation {
    makeCustomerAdminOfCustomerManagedGroup(
      groupId: ID!
      customerId: ID!
    ): CustomerManagedGroup!
  }
`;
