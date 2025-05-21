# Vendure Auto Cancel Orders Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-auto-cancel-orders)

This plugin provides functionality to automatically cancel orders after a specified delay period. It's useful for scenarios where you want to automatically cancel orders that haven't been settled after a certain period of time.

This prevents issues with stale orders that have out of stock items in them, or items that are no longer available.

## Getting started

Add the plugin to your `vendure-config.ts`

```ts
import { AutoCancelOrdersPlugin } from '@pinelab/vendure-plugin-auto-cancel-orders';

plugins: [
  AutoCancelOrdersPlugin.init({
    olderThanDays: 30,
  }),
],
```

Manually call `/auto-cancel-orders-plugin/cancel-stale-orders/` or create a cronjob that periodically calls this endpoint.

- Only deletes up to 10 000 orders per job run
- Only cancels orders that are in `AddingItems`, `Created` or `ArrangingPayment` state
- Check your logs for uncancellable orders. These issues, if any, should be fixed manually, to prevent them from being processed infinitely by this plugin.
