# Vendure SendCloud plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-sendcloud)

This plugin syncs orders to the SendCloud fulfillment platform.

## How it works

1. When an order is placed, it is automatically sent to SendCloud as a parcel (for label creation).
2. The order stays in `PaymentSettled` state in Vendure — **no fulfillment is created at this point**.
3. Once an order has been sent to SendCloud, SendCloud is responsible for tracking status. The Vendure order will simply be transitioned to `Delivered` by the included scheduled task. This is because orders are sometimes cancelled and duplicated in Sendcloud, resulting in misaligned stock.

## Getting started

1. Add the plugin to your `vendure-config.ts`:

```ts
plugins: [
  SendcloudPlugin.init({}),
  ...
]
```

2. Add the SendCloud Ui to the Vendure admin:

```ts
AdminUiPlugin.init({
  port: 3002,
  route: 'admin',
  app: compileUiExtensions({
    outputPath: path.join(__dirname, '__admin-ui'),
    extensions: [SendcloudPlugin.ui],
  }),
}),
```

3. Run a DB [migration](https://www.vendure.io/docs/developer-guide/migrations/) to add the new SendCloudConfigEntity to
   the database.
4. Go to your SendCloud account and go to `Settings > Integrations` and create an integration.
5. Write down the `secret` and `publicKey` of the created integration.
6. Start Vendure and login as admin.
7. Make sure you have the permission `SetSendCloudConfig`.
8. Go to `Settings > SendCloud`.
9. Fill in your SendCloud `secret` and `public key` here and click save.
10. Additionally, you can set a fallback phone number, for when a customer hasn't filled out one. A phone number is
    required by Sendcloud in some cases.

## Scheduled task: fulfill settled orders

An optional scheduled task `fulfillSettledOrdersTask` is included to automatically transition settled orders to `Delivered`.
It is **not auto-registered** — you need to add it to your `schedulerOptions.tasks` yourself.

The task runs nightly (default 2:00 AM) and processes all `PaymentSettled` orders placed within the last N days
(default 7) that use the SendCloud fulfillment handler. Each qualifying order is fulfilled and transitioned to `Delivered`.

Do not manually change order statuses in Vendure if you use this scheduled task. The task will fulfill orders and transition to delivered every night.

```ts
import { DefaultSchedulerPlugin } from '@vendure/core';
import {
  SendcloudPlugin,
  fulfillSettledOrdersTask,
} from '@pinelab/vendure-plugin-sendcloud';

const config: VendureConfig = {
  plugins: [SendcloudPlugin.init({}), DefaultSchedulerPlugin.init()],
  schedulerOptions: {
    tasks: [
      // Use defaults (every day at 2:00 AM, look back 7 days)
      fulfillSettledOrdersTask,
      // Or configure the task
      fulfillSettledOrdersTask.configure({
        schedule: (cron) => cron.everyDayAt(3, 0),
        params: { settledSinceDays: 14 },
      }),
    ],
  },
};
```

## Additional configuration

You can choose to send additional info to SendCloud: `weight`, `hsCode`, `origin_country` and additional parcel items.
Parcel items will show up as rows on your SendCloud packaging slips.

```ts
import {
  SendcloudPlugin,
  getNrOfOrders,
} from '@pinelab/vendure-plugin-sendcloud';

plugins: [
  SendcloudPlugin.init({
    /**
     * Implement the weightFn to determine the weight of a parcel item,
     * or set a default value
     */
    weightFn: (line) =>
      (line.productVariant.product?.customFields as any)?.weight || 5,
    /**
     * Implement the hsCodeFn to set the hsCode of a parcel item,
     * or set a default value
     */
    hsCodeFn: (line) =>
      (line.productVariant.product?.customFields as any)?.hsCode || 'test hs',
    /**
     * Implement the originCountryFn to set the origin_country of a parcel item,
     * or set a default value
     */
    originCountryFn: (line) => 'NL',
    /**
     * Implement the additionalParcelItemsFn to add additional rows to the SendCloud order.
     * This example adds the nr of previous orders of the current customer to SendCloud
     */
    additionalParcelItemsFn: async (ctx, injector, order) => {
      const additionalInputs = [];
      additionalInputs.push(await getNrOfOrders(ctx, injector, order));
      return additionalInputs;
    },
  }),
];
```
