# Admin UI helper buttons for Vendure

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-admin-ui-helpers)

Cancel and complete order buttons for easier completion and cancellation of orders.

## Getting started

Add the buttons you want to the AdminUiPlugin config:

```ts
import {
  cancelOrderButton,
  completeOrderButton,
} from 'vendure-plugin-admin-ui-helpers';

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
