# Modify Customer Orders plugin

This plugin allows you to convert an active order from a customer to a Draft order, edit it, and connect it back to the customer.

1. Login as administrator, open an order in the `AddingItems` state, and click
   the actions dropdown in the top-right of the order detail page.
2. Click 'Convert to Draft'
3. The order can now be edited as admin under 'Drafts'
4. Click `Complete draft` to connect the order as active order to a customer. (This behaviour can be disabled, see `autoAssignDraftOrdersToCustomer` below)

When you connect a Draft order to a customer, the customers existing active order will be made a Draft.

## Getting started

```ts
// vendure-config.ts
import { ModifyCustomerOrdersPlugin } from '@pinelab/vendure-plugin-modify-customer-orders';

plugins: [
  ModifyCustomerOrdersPlugin.init({
    /**
     * Automatically make completed draft orders active orders for the connected customer
     */
    autoAssignDraftOrdersToCustomer: true,
  }),
];
```

The "Convert to Draft" action is added as a dropdown item in the order detail
page's action bar via the React Dashboard extension API — no Admin UI
compilation step is needed.
