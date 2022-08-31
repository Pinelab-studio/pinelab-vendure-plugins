# Vendure Webhook plugin

Triggers a webhook based on configured events. Events are specified in `vendure-config` and webhooks are configured per
channel via the admin UI.

Use this plugin to trigger builds when ProductEvents or CollectionEvents occur, or send notifications to external
platforms when orders are placed by subscribing to OrderPlacedEvents!

## Plugin setup

1. `yarn add vendure-plugin-webhook`
2. Add the WebhookPlugin to your plugins in your `vendure-configt.ts`:

```ts
import { WebhookPlugin } from 'vendure-plugin-webhook';

plugins: [
  WebhookPlugin.init({
    httpMethod: 'POST',
    /**
     * Optional: 'delay' Deduplicates events within 3000ms.
     * If 4 events were fired for the same channel within 3 seconds,
     * only 1 webhook call will be sent
     */
    delay: 3000,
    events: [ProductEvent, ProductVariantChannelEvent, ProductVariantEvent],
    /**
     * Optional: 'requestFn' allows you to send custom headers
     * and a custom body with your webhook call.
     * Without this function, the webhook POST will have an empty body
     */
    requestFn: (event) => {
      return {
        headers: { test: '1234' },
        body: JSON.stringify({ createdAt: event.createdAt }),
      };
    },
  }),
];
```

3. The plugin adds an entity `WebhookPerChannelEntity` to your database. Don't forget to run a migration
   OR `synchronize: true` if you like living on the edge.
4. Add `Webhook.ui` to your admin UI extensions:

```ts
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import * as path from 'path';
import { WebhookPlugin } from 'vendure-plugin-webhook';

compileUiExtensions({
  outputPath: path.join(__dirname, '__admin-ui'),
  extensions: [WebhookPlugin.ui],
})
  .compile?.()
  .then(() => {
    process.exit(0);
  });
```

For more information on admin UI extensions
see https://www.vendure.io/docs/plugins/extending-the-admin-ui/#compiling-as-a-deployment-step

5. Start the server and assign the permission `SetWebhook` to administrators who should be able to set webhooks.
6. Go to `settings > webhook` to set the webhook url for the current channel.

## Enjoying our plugins?

Enjoy the Pinelab Vendure plugins? [Consider becoming a sponsor](https://github.com/sponsors/Pinelab-studio).

Or check out [pinelab.studio](https://pinelab.studio) for more articles about our integrations.
<br/>
<br/>
<br/>
[![Pinelab.studio logo](https://pinelab.studio/assets/img/favicon.png)](https://pinelab.studio)
