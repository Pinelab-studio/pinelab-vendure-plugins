# Vendure Anonymized Order

This plugin enables the retrieval of an anonymized customer order. By default, the `anonymizedOrder` query omits the fields `customer`, `billingAddress`, and `shippingAddress` from the order details. However, users have the flexibility to further customize this process by adding a callback, allowing the removal of additional fields as needed.

## Getting started

Add the plugin to your config:

```ts
import { AnonymizedOrderPlugin } from '@pinelab/vendure-plugin-anonymized-order';
plugins: [AnonymizedOrderPlugin.init({})];
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

## Customizing what data is removed

You can supply your own strategy for anonymizing a given order. In that case, **the plugin will not remove any data from the order** for you.

The example below will only remove the customer, but still expose shipping and billing address:

```ts
import { AnonymizedOrderPlugin } from '@pinelab/vendure-plugin-anonymized-order';
plugins: [
  AnonymizedOrderPlugin.init({
    anonymizeOrderFn: (order) => {
      order.customer = {};
    },
  }),
];
```

You should be cautious about what to return, because of the relational nature of GraphQL. For example, exposing the `order.customer`, will also allow the client to query `order.customer.orders`, thus exposing all orders of that customer.
