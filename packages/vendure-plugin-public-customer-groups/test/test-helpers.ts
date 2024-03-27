import { gql } from 'graphql-tag';
import { CreateCustomerGroupInput } from '@vendure/common/lib/generated-types';

export const addCustomerToGroups = gql`
  mutation createCustomerGroup($input: CreateCustomerGroupInput!) {
    createCustomerGroup(input: $input) {
      id
      name
      customFields {
        isPublic
      }
    }
  }
`;

export const getActiveCustomer = gql`
  query GetActiveCustomerDetails {
    activeCustomer {
      customerGroups {
        id
        customers {
          items {
            id
          }
        }
      }
    }
  }
`;

export const publicCustomerGroupInput: CreateCustomerGroupInput = {
  name: 'Public Group',
  //hayden.zieme12@hotmail.com's id
  customerIds: ['T_1'],
  customFields: {
    isPublic: true,
  },
};

export const nonPublicCustomerGroupInput: CreateCustomerGroupInput = {
  name: 'Non Public Group',
  //hayden.zieme12@hotmail.com's id
  customerIds: ['T_1'],
  customFields: {
    isPublic: false,
  },
};

export const CUSTOMER_GROUP_FRAGMENT = gql`
  fragment CustomerGroup on CustomerGroup {
    id
    createdAt
    updatedAt
    name
  }
`;

export const CREATE_CUSTOMER_GROUP = gql`
  mutation CreateCustomerGroup($input: CreateCustomerGroupInput!) {
    createCustomerGroup(input: $input) {
      ...CustomerGroup
    }
  }
  ${CUSTOMER_GROUP_FRAGMENT}
`;
