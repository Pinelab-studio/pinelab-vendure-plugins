# Vendure Public Customer Groups

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-public-customer-groups)

This plugin adds a custom field `isPublic` to `CustomerGroup`s, so that we can determine if a `CustomerGroup` is publicly available. It also adds a GraphQL field `Customer.customerGroups` that returns the public customerGroups to the Shop API.

## Getting started

Add the plugin to your `vendure-config.ts`:

```ts
import { PublicCustomerGroupsPlugin } from '@pinelab/vendure-plugin-public-customer-groups';
plugins: [PublicCustomerGroupsPlugin];
```

Run a database migration to add the `isPublic` custom field to Customer Group.

In the admin UI, under customer groups, you can now expose a customer group by setting `isPublic=true`.
