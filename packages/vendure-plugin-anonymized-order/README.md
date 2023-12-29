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

## Displaying placed order without requiring the customer to log in

The `anonymizedOrder` query can be used to display a customers' placed order permanently, instead of for a limited time only, like the built-in `orderByCode` query. This can be used to show a placed order via a link in email for example.

In the order confirmation email, you could have a link like `https://my-storefront.io/order/GX83VCD73?emailAddress=the-customer@email.com`. On your storefront, you'd then use the following query to display the order:

```graphql
    anonymizedOrder(orderCode: "GX83VCD73", emailAddress: "the-customer@email.com") {
      id
      code
      totalWithTax
      lines {
        id
        linePriceWithTax
      }
    }
```

This will then return the order without `shippingAddress`, `billingAddress` and `customer` fields.
