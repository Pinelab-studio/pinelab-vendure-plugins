# Frequently Bought Together Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/pinelab-frequently-bought-together-plugin)

This plugin finds products that are often bought together by looking at past orders. You can integrate these frequently bought together products on your storefront, and so increase your revenue.

## Installation

1. Add the plugin to your Vendure config, together with the `DefaultSchedulerPlugin`.
   The plugin registers a scheduled task that recalculates relations for all channels,
   **enabled by default** (nightly at 3:00 AM):

```ts
import { FrequentlyBoughtTogetherPlugin } from '@vendure-hub/pinelab-frequently-bought-together-plugin';
import { DefaultSchedulerPlugin } from '@vendure/core';

const vendureConfig = {
  plugins: [
    FrequentlyBoughtTogetherPlugin.init({
      // Disable this in production!
      experimentMode: true,
      // Test this support level first. See below for more details.
      supportLevel: 0.001,
    }),
    // Required for the scheduled task to run
    DefaultSchedulerPlugin.init(),
  ],
};
```

2. Run a database migration to add the custom fields to your database.

### Scheduled recalculation task

The plugin recalculates "frequently bought together" relations for all channels on a
schedule. This task is **always enabled** and runs **nightly at 3:00 AM** by default.
The `DefaultSchedulerPlugin` must be present for it to run.

You can change **when** it runs via the `scheduledTask` plugin option (the task cannot
be disabled):

```ts
FrequentlyBoughtTogetherPlugin.init({
  // Change the schedule (a cron-time-generator function):
  scheduledTask: { schedule: (cron) => cron.everyDayAt(4, 0) },
  // ...or a plain cron expression:
  // scheduledTask: { schedule: '0 4 * * *' },
});
```

## Triggering a calculation manually

Besides the scheduled task, you can also trigger a calculation on demand via the admin API, for the channel of the
current request:

```graphql
mutation {
  triggerFrequentlyBoughtTogetherCalculation
}
```

## Storefront usage

You can get the related product via the shop API with the following query:

```graphql
{
  product(id: 2) {
    id
    name
    slug
    frequentlyBoughtWith {
      id
      name
      slug
    }
  }
}
```

Product relations in the Shop API are sorted by support, meaning that the most bought together products will appear first in the list.
The admin UI shows relations in random order due to the unordered nature of SQL relations.

## Experiment mode

Each shop's optimal support level varies based on data density. For example, a shop with many variants and few orders requires a lower support level. To experiment with support levels:

1. Start the server locally, and make sure you have set `experimentMode: true` in the plugin's init function.
2. Go to `http://localhost:3000/admin-api` or use a GraphQL client like Yaak to use the admin API
3. Execute the following query against the admin api:

```graphql
{
  previewFrequentlyBoughtTogether(support: 0.1) {
    # The peak amount of memory that was used during calculation. This should be a max of 80% of your worker instance
    maxMemoryUsedInMB
    # The different products that are included in the relations
    uniqueProducts
    # Total number of item sets
    totalItemSets
    # Most confident item sets
    bestItemSets {
      # E.g. ['product-1', 'product-5']
      items
      # Support is the number of orders this combination was in
      support
    }
    # Least confident item sets
    worstItemSets {
      items
      support
    }
  }
}
```

When you have found your desired support level, you set it in the plugin:

```ts
      FrequentlyBoughtTogetherPlugin.init({
        // Disable experiment mode in production!
        experimentMode: false,
        supportLevel: 0.00005
      }),
```

1. Run the server again
2. Trigger a calculation manually via the `triggerFrequentlyBoughtTogetherCalculation` admin API mutation (see
   above), or wait for the scheduled task to run

The frequently bought together relations are now set on your products.

Tips for Tweaking Support Levels:

- Start high (e.g., `0.1`) and gradually reduce (`0.01`, `0.001`, etc.).
- Review the worst item sets:
  - Increase the support level if they seem irrelevant.
  - If support equals 1, it indicates a single order—a poor indicator of frequent purchases.
- Monitor memory usage to avoid exceeding worker RAM.

## Channel specific support

To set different support levels for channels:

```ts
      FrequentlyBoughtTogetherPlugin.init({
        // Disable experiment mode in production!
        experimentMode: false,
        supportLevel: (ctx) => {
            if (ctx.channel.token === 'channel-with-lots-of-variants') {
                return 0.000001
            } else {
                return 0.0001
            }
        }
      }),
```

Use the `vendure-token` header to preview queries for specific channels.
