# Admin UI helper buttons for Vendure

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-admin-ui-helpers)

Cancel and complete order buttons for easier completion and cancellation of orders.

## Getting started

Add the buttons you want to the AdminUiPlugin config:

```ts
import {
  cancelOrderButton,
  completeOrderButton,
} from '@pinelab/vendure-plugin-admin-ui-helpers';

AdminUiPlugin.init({
  port: 3002,
  route: 'admin',
  app: compileUiExtensions({
    outputPath: path.join(__dirname, '__admin-ui'),
    extensions: [
      /**
       * Adds a 'Complete order' to the order detail overview.
       * This transitions the order to the `Delivered` state.
       */
      completeOrderButton,
      /**
       * Adds a 'Cancel order' to the order detail overview.
       * Cancels and refunds the order.
       */
      cancelOrderButton,
    ],
  }),
});
```
