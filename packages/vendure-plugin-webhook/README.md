# Vendure Webhook plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-webhook/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-webhook)

Triggers a webhook based on configured events. Events are specified in `vendure-config` and webhooks are configured per
channel via the admin UI.

Use this plugin to trigger builds when ProductEvents or CollectionEvents occur, or send notifications to external
platforms when orders are placed by subscribing to OrderPlacedEvents!

## Getting started

1. `yarn add vendure-plugin-webhook`
2. Add the `WebhookPlugin` to your plugins in your `vendure-configt.ts`:

```ts
import { WebhookPlugin } from 'vendure-plugin-webhook';

plugins: [
  WebhookPlugin.init({
    httpMethod: 'POST',
    /**
     * Optional: 'delay' waits and deduplicates events for 3000ms.
     * If 4 events were fired for the same channel within 3 seconds,
     * only 1 webhook call will be sent
     */
    delay: 3000,
    events: [ProductEvent, ProductVariantEvent],
    /**
     * Optional: 'requestFn' allows you to send custom headers
     * and a custom body with your webhook call.
     * By default, the webhook POST will have an empty body
     */
    requestFn: async (
      event: ProductEvent | ProductVariantEvent,
      injector: Injector
    ) => {
      // Get data via injector and build your request headers and body
      const { id } = await injector
        .get(ChannelService)
        .getChannelFromToken(event.ctx.channel.token);
      return {
        headers: { test: '1234' },
        body: JSON.stringify({ createdAt: event.createdAt, channelId: id }),
      };
    },
  }),
];
```

3. The plugin adds an entity `WebhookPerChannelEntity` to your database. Don't forget to run a migration
   OR `synchronize: true` if you like living on the edge.
4. Add `Webhook.ui` to your admin UI extensions:

```ts
import { WebhookPlugin } from 'vendure-plugin-webhook';

plugins: [
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [WebhookPlugin.ui],
    }),
  }),
];
```

For more information on admin UI extensions
see https://www.vendure.io/docs/plugins/extending-the-admin-ui/#compiling-as-a-deployment-step

5. Start the server and assign the permission `SetWebhook` to administrators who should be able to configure webhooks.
6. Go to `settings > webhook` to set the webhook url for the current channel.
