# Vendure Customer Group Extensions

This plugin allows customers to manage their own groups, called Customer Managed Groups. Customer Managed Groups can have Group Admins and Group participants.

- Customers can only be in one group, and they are either group participant or group admin. (Customers can still be in multiple)
- Customers can create groups and add other non-admin customers to their group. Adding others to your group automatically makes you administrator of the group.
- Group Admins can fetch placed orders for everyone in the group.

## Getting started

Add the plugin to your config:

```ts
plugins: [...CustomerManagedGroupsPlugin];
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
