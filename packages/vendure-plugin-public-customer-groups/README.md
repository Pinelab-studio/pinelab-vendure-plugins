# Vendure Public Customer Groups

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-public-customer-groups)

This plugin adds a custom field `isPublic` to `CustomerGroup`s, so that we can determine if a `CustomerGroup` is publicly available. It also adds a GraphQL field `Customer.customerGroups` that returns the public customerGroups to the Shop API.

## Getting started

Add the plugin to your `vendure-config.ts`:

```ts
import { PublicCustomerGroupsPlugin } from '@pinelab/vendure-plugin-public-customer-groups';
plugins: [PublicCustomerGroupsPlugin];
```

And you're good to go with just that.
