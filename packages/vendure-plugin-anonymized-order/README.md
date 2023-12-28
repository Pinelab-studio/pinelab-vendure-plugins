# Vendure Anonymized Order

This plugin enables the retrieval of an anonymized customer order. By default, the `anonymizedOrder` query omits the fields `customer`, `billingAddress`, and `shippingAddress` from the order details. However, users have the flexibility to further customize this process by adding a callback, allowing the removal of additional fields as needed.

## Getting started

Add the plugin to your config:

```ts
import { AnonymizedOrderPlugin } from '@pinelab/vendure-plugin-anonymized-order';
plugins: [
  AnonymizedOrderPlugin.init({
    anonymizeOrderFn: (order) => {
      order.lines = [];
    },
  }),
];
```
