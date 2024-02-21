# Change Order Customer Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-change-order-customer)

This plugin allows you to change the customer of an order. This can be useful for when a customer accidentally used a wrong email address for example.

![image](https://pinelab-plugins.com/plugin-images/set-customer-for-order.png)

## Getting started

Add this plugin to your list of plugins in your `vendure-config.ts`

```ts
import { ChangeOrderCustomerPlugin } from '@pinelab/vendure-plugin-change-order-customer';

plugins: [
  ...ChangeOrderCustomerPlugin,
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [ChangeOrderCustomerPlugin.ui],
    }),
  }),
];
```

## Caveats

1. The plugin just assigns the new customer to the order, no re-applying promotions or recalculating of any prices. This could mean that promotions stay applied to the order that are actually not valid for the new customer.
2. The plugin only assigns the customer, it doesn't change the shipping address or billing address.
