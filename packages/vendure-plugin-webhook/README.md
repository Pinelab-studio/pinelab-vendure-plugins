# Vendure Webhook plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-webhook/dev/@vendure/core)

Triggers an outgoing webhook based on configured events. Events are specified in `vendure-config` and webhooks are configured per
channel via the admin UI.

YOu can use this plugin for example to trigger builds when ProductEvents or CollectionEvents occur, or send notifications to external
platforms when orders are placed by subscribing to OrderPlacedEvents!

## Breaking changes since v7.x

:warning: V7 of this plugin allows you to create multiple webhooks per channel for multiple different events. You have to manually recreate your webhooks after migration! (Don't forget your DB migration):

- Check what URL is triggered for what event in your current environment, and note it down somewhere.
- Install the new version, migrate, start the server, and go to `Settings > Webhook` in the Admin UI.
- Create the hook. You can leave the `Transformer` field blank: the plugin will send an empty post without a transfomer.

## Getting started

1. `yarn add vendure-plugin-webhook`
2. Add the `WebhookPlugin` to your plugins in your `vendure-config.ts`:

```ts
import { WebhookPlugin } from 'vendure-plugin-webhook';

plugins: [
  WebhookPlugin.init({
    /**
     * Optional: 'delay' waits and deduplicates events for 3000ms.
     * If 4 events were fired for the same channel within 3 seconds,
     * only 1 webhook call will be sent
     */
    delay: 3000,
    events: [ProductEvent, ProductVariantEvent],
    /**
     * Optional: A requestTransformer allows you to send custom headers
     * and a custom body with your webhook call.
     * If no transformers are specified
     */
    requestTransformers: [],
  }),
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      // Add the WebhookPlugin's UI to the admin
      extensions: [WebhookPlugin.ui],
    }),
  }),
];
```

3. Run a DB migration to create the custom entities.
4. Start the server and assign the permission `SetWebhook` to administrators who should be able to configure webhooks.
5. Go to `settings > webhook` to configure webhooks

### Custom transformers

Request transformers are used to create a custom POST body and custom headers for your outgoing webhooks. The example below stringifies the contents of a ProductEvent.

```ts
import { Logger, ProductEvent } from '@vendure/core';
import { RequestTransformer } from 'vendure-plugin-webhook';

export const stringifyProductTransformer = new RequestTransformer({
  name: 'Stringify Product events',
  supportedEvents: [ProductEvent],
  transform: (event, injector) => {
    if (event instanceof ProductEvent) {
      return {
        body: JSON.stringify(event),
        headers: {
          'x-custom-header': 'custom-example-header',
          'content-type': 'application/json',
        },
      };
    } else {
      throw Error(`This transformer is only for ProductEvents!`);
    }
  },
});

// In your vendure-config's plugin array:
WebhookPlugin.init({
  events: [ProductEvent],
  requestTransformers: [stringifyProductTransformer],
});
```
