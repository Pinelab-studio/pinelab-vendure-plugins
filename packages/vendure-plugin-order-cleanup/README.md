# Vendure Order Cleanup Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-order-cleanup)

This plugin automatically empties stale active orders so their items are released without deleting the orders or changing their current state.

## Behavior

Each cleanup run selects non-empty orders that:

- have not been updated for longer than `olderThanDays`;
- are in `AddingItems`, `Created`, or `ArrangingPayment`; and
- still contain at least one order line.

Every selected order is preserved in its existing state while all of its order lines are removed and its totals are recalculated. Already-empty orders are not selected again. If one order cannot be emptied, the error is logged and the run continues with the remaining orders.

Cleanup uses bounded pages, processes orders in configurable concurrent batches, and attempts at most 10,000 orders per run. Any remaining work is deferred to the next scheduled run.

## Getting started

Vendure's scheduled-task system requires a scheduler strategy. Add `DefaultSchedulerPlugin` if your application does not already configure one:

```ts
import { DefaultSchedulerPlugin, VendureConfig } from '@vendure/core';
import { OrderCleanupPlugin } from '@pinelab/vendure-plugin-order-cleanup';

export const config: VendureConfig = {
  // ...
  plugins: [
    OrderCleanupPlugin.init({
      olderThanDays: 30,
    }),
    DefaultSchedulerPlugin.init(),
  ],
};
```

When `DefaultSchedulerPlugin` is added to an existing application, follow Vendure's scheduled-task documentation and generate the scheduler-table migration required by that plugin. The order-cleanup plugin itself adds no entities or database migration.

## Configuration

```ts
OrderCleanupPlugin.init({
  // Required: orders older than this cutoff are eligible.
  olderThanDays: 30,

  // Optional, default 10. Use 1 for SQLite.
  batchSize: 10,

  schedule: {
    // Optional five-field cron expression. Default: daily at 03:00.
    cron: '0 3 * * *',

    // Optional IANA timezone. Default: Europe/Amsterdam.
    timezone: 'Europe/Amsterdam',

    // Optional Vendure task timeout. Default: 1 hour.
    timeout: '1h',
  },
});
```

Cron matching is timezone-aware and handles daylight-saving changes. Vendure 3.6 does not expose a timezone option for an individual `ScheduledTask`, so the plugin registers a lightweight once-per-minute Vendure task and only queries orders when the configured cron expression matches in the configured timezone.

Invalid ages, batch sizes, five-field cron expressions, or IANA timezones fail during configuration.

## Upgrading from 1.x

Version 2.0.0 contains two breaking changes:

1. Stale orders are emptied and preserved in their current state instead of being cancelled.
2. `GET /order-cleanup/trigger` has been removed. Delete external cron jobs or scripts that call this endpoint and configure Vendure scheduling as shown above.

Before upgrading, ensure a Vendure scheduler strategy is configured and any migration required by `DefaultSchedulerPlugin` has been generated and deployed through your application's normal migration process.
