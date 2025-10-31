# Vendure Shipmate Plugin

### [Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-shipmate)

Create shipments in Shipmate on every order placed, to automate your order fulfillment process.

## Getting started

1. Add the plugin to your `vendure-config.ts`

```ts
import { ShipmatePlugin } from '@pinelab/vendure-plugin-shipmate';

...
plugins: [
  ShipmatePlugin.init({
    apiUrl: 'https://api.shipmate.co.uk/v1.2', // Or https://api-staging.shipmate.co.uk/v1.2 for the testing environment
    shouldSendOrder: function ( ctx: RequestContext, order: Order): Promise<boolean> | boolean {
      // Sample implementation that only sends orders with less than 5 items to Shipmate
      return order.totalQuantity < 5;
    }
  }),
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [
        ShipmatePlugin.ui
        ... // your other plugin UI extensions
      ],
    }),
  }),
... // your other plugins
]

```

2. [Compile the admin UI](https://docs.vendure.io/guides/extending-the-admin-ui/getting-started/#setup) to include the Shipmate configuration page
3. Log in to your Shipmate account.
4. Note down your API key from Profile > Settings > API Keys
5. Create two webhooks. One with trigger `Tracking Status updates to Collected` and one with `Tracking Status updates to Delivered`, pointing to url `https://<your Vendure server>/shipmate`. Set `JSON` as format. This will make sure your Vendure Order is synced when the shipment is being Shipped or Delivered.
6. Start Vendure, log in, and navigate to Settings > Shipmate
7. Fill in your API Key, username and password. The plugin will authenticate as the given user when creating shipments.
8. Fill in both Auth tokens from the created webhooks that were created in Shipmate. You can find it on the webhook detail screen. The plugin uses this token to validate if incoming events are really from Shipmate.
9. Click 'Save'

### Test the plugin

1. Place a test order.
