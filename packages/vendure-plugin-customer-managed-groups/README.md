# Vendure Customer Group Extensions

This plugin allows customers to manage their own groups, called Customer Managed Groups. Customer Managed Groups can have Group Admins and Group members.

- Group admins and members are stored as Vendure's built-in customers, and the groups are the built-in Customer Group entities.
- Customers can only be in one group, and they are either group participant or group admin. (Customers can still be in multiple)
- Customers can create groups and add other non-admin customers to their group. Adding others to your group automatically makes you administrator of the group.
- Group Admins can fetch placed orders for everyone in the group.
- Group Admins can update profile details of members of their group.

## Getting started

Add the plugin to your config:

```ts
import { CustomerManagedGroupsPlugin } from 'vendure-plugin-customer-managed-group';
plugins: [CustomerManagedGroupsPlugin];
```

You can create your own group via the Shop API, if you are logged in as a customer, by inviting another customer by email:

```graphql
  mutation {
    addCustomerToMyCustomerManagedGroup('invitee@gmail.com') {
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
  }
```

You can also remove participants again, by passing in the customer id that should be removed:

```graphql
  mutation {
    removeCustomerToMyCustomerManagedGroup('2') {
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
  }
```

Admins are allowed to fetch orders of all customers in a group. You can do this with the following query:

```graphql
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
```

These are all the GraphQL queries and mutations exposed by this plugin:

```graphql
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
```
