# Vendure Shipmate Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-shipmate)

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
... // your other plugins
]

```

2. Log in to your Shipmate account.
3. Note down your API key from Profile > Settings > API Keys
4. Create two webhooks. One with trigger `Tracking Status updates to Collected` and one with `Tracking Status updates to Delivered`, pointing to url `https://<your Vendure server>/shipmate`. Set `JSON` as format. This will make sure your Vendure Order is synced when the shipment is being Shipped or Delivered.
5. Start Vendure and go to `Settings` > `Channels`, open the channel you want
   to configure and select the **Shipmate** tab. Configuration is stored per
   channel as Channel custom fields, so no Admin UI extension needs to be
   compiled.
6. Fill in your `API key`, `Username` and `Password`. The plugin will
   authenticate as the given user when creating shipments.
7. Fill in both auth tokens from the webhooks created in Shipmate under
   `Webhook auth tokens` (one entry per token). You can find each token on the
   webhook detail screen. The plugin uses these tokens to validate that
   incoming events are really from Shipmate.

> Shipmate is considered enabled for a channel once `API key`, `Username` and
> `Password` are all set.

### Test the plugin

1. Place a test order.
