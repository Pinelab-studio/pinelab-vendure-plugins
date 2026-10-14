# Vendure Content Automation Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-content-automation)

This plugin orchestrates bulk generation and enrichment of entity content, like SEO meta titles and descriptions, for every channel and language. The actual content generation is done by your own strategies: the plugin doesn't include an AI provider, prompt format or content logic.

- Runs your content generation nightly, via background jobs.
- Processes every available language of every channel.
- Doesn't regenerate content when its input hasn't changed.
- Shows all updates in the Vendure Dashboard.

## Getting started

1. Add the plugin to your config. Vendure's scheduled tasks require a scheduler, so add `DefaultSchedulerPlugin` if you don't have one configured yet:

```ts
import { DefaultSchedulerPlugin } from '@vendure/core';
import { ContentAutomationPlugin } from '@pinelab/vendure-plugin-content-automation';

// In your plugins array, in vendure-config.ts
plugins: [
  ContentAutomationPlugin.init({
    automationStrategies: [new ProductMetaTagsAutomation()],
  }),
  DefaultSchedulerPlugin.init(),
];
```

2. Run a [database migration](https://docs.vendure.io/guides/developer-guide/migrations/) to add the `ContentAutomationUpdate` entity. If you just added `DefaultSchedulerPlugin`, the migration also adds the tables required by that plugin.
3. Implement a strategy, see [Writing a strategy](#writing-a-strategy).
4. Run the [initial population](#initial-population) once, before the first nightly run.

## Writing a strategy

A strategy loads the input data needed for generation, and generates and saves the content for a single input. A project can have multiple strategies, for example one for product meta tags and one for variant descriptions.

The example below assumes you have defined `metaTitle` and `metaDescription` as `localeString` [custom fields](https://docs.vendure.io/guides/developer-guide/custom-fields/) on `Product`.

```ts
import { ID, Injector, ProductService, RequestContext } from '@vendure/core';
import {
  ContentAutomationResult,
  ContentAutomationStrategy,
} from '@pinelab/vendure-plugin-content-automation';

/**
 * The input needed to generate the meta title and description of a product, in a specific language
 */
interface MetaTagsInput {
  id: ID;
  description: string;
}

/**
 * Generates the meta title and description of products, based on their description
 */
export class ProductMetaTagsAutomation
  implements ContentAutomationStrategy<MetaTagsInput>
{
  // Stable, unique key, used in the stored state. Don't change it after going live.
  name = 'product-metatags-ai';

  // Called once for every channel and language: `ctx` is scoped to that channel and language.
  async loadInputData(
    ctx: RequestContext,
    injector: Injector
  ): Promise<MetaTagsInput[]> {
    // `take` limits the number of results: page through all products if you have more
    const products = await injector
      .get(ProductService)
      .findAll(ctx, { take: 1000 });
    return products.items.map((p) => ({
      id: p.id,
      description: p.description,
    }));
  }

  async generateAndSaveContent(
    ctx: RequestContext,
    injector: Injector,
    input: MetaTagsInput
  ): Promise<ContentAutomationResult | false> {
    if (!input.description.trim()) {
      // Can't generate meta tags without a description
      return false;
    }
    // `yourAiClient` is a placeholder for your own AI provider.
    // Throwing an error here will fail the job, and it will be retried
    const { metaTitle, metaDescription } = await yourAiClient.generate(
      'Generate a meta title and description for this description',
      input.description
    );
    await injector.get(ProductService).update(ctx, {
      id: input.id,
      translations: [
        {
          languageCode: ctx.languageCode,
          customFields: { metaTitle, metaDescription },
        },
      ],
    });
    return {
      resultMessage: 'Updated meta title and description',
      entityUrl: `/products/${input.id}`,
    };
  }
}
```

### Strategy API

| Method                                         | Description                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                         | Stable, unique key, e.g. `product-metatags-ai`. Used in the stored state. The plugin throws on startup when names aren't unique.                                                                                                                                |
| `loadInputData(ctx, injector)`                 | Called once per channel and language. Returns all inputs needed for generation. Inputs are passed to background jobs, so they have to be JSON serializable.                                                                                                     |
| `generateHash(ctx, input)`                     | Optional. Returns a deterministic fingerprint of the fields relevant for generation. By default, the plugin hashes all fields of the input, with sorted keys. Hashes longer than 191 characters are hashed again with SHA-256, so they fit the database column. |
| `generateAndSaveContent(ctx, injector, input)` | Generates the content and saves it to the entity. Use your own services, so validation, events and other side effects are applied. Return a result on success, `false` to deliberately skip, or throw for transient failures.                                   |

The result of `generateAndSaveContent` can have an optional `resultMessage` and an `entityUrl`. The `entityUrl` is a Dashboard route, like `/products/1`, and is used to link to the entity from the Dashboard.

The `ctx` passed to your strategy is an Admin API context for the channel and language being processed. There is no logged-in user, so don't rely on `ctx.activeUserId`.

### Important: what to include in the input

- **Include the id of the entity.** Every input must contain `id: ID`. The plugin compares its hash against the latest successful update for that entity, strategy, channel and language. Reverting to an older input regenerates content.
- **Don't include fields your strategy writes.** If the input of the meta tags strategy would include the meta title, every generation changes the input, and the product would be regenerated every night.

## How it works

Every night, a scheduled task with id `content-automation` runs:

1. For every strategy, every channel, and every available language of that channel, `loadInputData()` is called.
2. A hash is generated for every input.
3. If the latest `ContentAutomationUpdate` for the entity, strategy, channel and language has the same hash, the input is unchanged and skipped.
4. For every changed input, a job is created in the `content-automation` job queue, containing the strategy name, the input, the hash and the serialized `RequestContext`.
5. The job resolves the strategy by its name, and calls `generateAndSaveContent()` with the original ctx and input:
   - When a result is returned, a `ContentAutomationUpdate` is stored.
   - When `false` is returned, nothing is stored, so the input is offered again the next night.
   - When an error is thrown, nothing is stored, and the job is retried up to 3 times.

When `loadInputData()` throws, the error is logged, and that strategy, channel and language is skipped until the next run. Other strategies, channels and languages are still processed.

The task runs at 02:00 server time by default, with a timeout of 1 hour. You can run it on demand via the Scheduled Tasks page in the Dashboard, or change the schedule and timeout:

```ts
import { contentAutomationTask } from '@pinelab/vendure-plugin-content-automation';

contentAutomationTask.configure({
  schedule: (cron) => cron.everyDayAt(4, 0),
  timeout: '2h',
});
```

The timeout only covers loading and comparing inputs, and creating the jobs: the content generation itself runs in the jobs. When the task times out, Vendure marks it as failed while it keeps running in the background, so increase the timeout if loading your inputs takes longer than an hour.

Job data is fully serializable, so it also works with job queues that pass jobs over HTTP, like the [Google Cloud Tasks plugin](https://plugins.pinelab.studio/plugin/vendure-plugin-google-cloud-tasks).

## Stored state

Every successful generation is stored as a `ContentAutomationUpdate`:

| Field           | Description                                           |
| --------------- | ----------------------------------------------------- |
| `strategyName`  | The strategy that generated the content.              |
| `entityId`      | The input's required entity id.                       |
| `channelId`     | The channel the content was generated for.            |
| `languageCode`  | The language the content was generated for.           |
| `hash`          | The hash of the input the content was generated from. |
| `resultMessage` | The optional message returned by the strategy.        |
| `entityUrl`     | The optional Dashboard URL returned by the strategy.  |

The generated content itself is not stored by the plugin: your strategy saves it on the entity. One record is kept per entity, strategy, channel and language, enforced by a composite unique index. Successful generation updates its hash, result message and entity URL; `false` or errors leave the previous state unchanged. These records represent current state, not an audit log.

When a job runs and the hash of its input was already stored in the meantime, for example by a duplicate job, the job is skipped without calling your strategy.

### Admin API

The updates of the active channel can be queried via the Admin API, with Vendure's standard list options for filtering, sorting and pagination. Requires the `ReadCatalog` permission.

```graphql
query {
  contentAutomationUpdates(
    options: {
      sort: { updatedAt: DESC }
      filter: { strategyName: { eq: "product-metatags-ai" } }
    }
  ) {
    items {
      createdAt
      strategyName
      languageCode
      resultMessage
      entityUrl
    }
    totalItems
  }
}
```

## Initial population

When no state exists yet, the first nightly run would create a job for every input, of every channel and language, at once. To prevent this burst of jobs, run the initial population once before the first nightly run. It does the same as the nightly run, but processes all changed inputs sequentially, without creating jobs. Failures are logged, and processing continues with the next input.

Create a script in your Vendure project, for example `scripts/content-automation-population.ts`:

```ts
import { bootstrapWorker } from '@vendure/core';
import { runContentAutomationPopulation } from '@pinelab/vendure-plugin-content-automation';

// Load env before config
require('dotenv').config({ path: process.env.ENV_FILE });

import('../src/vendure-config')
  .then(async ({ config }) => {
    // A worker doesn't start the HTTP server, so it can run next to your running Vendure server
    const { app } = await bootstrapWorker(config);
    const result = await runContentAutomationPopulation(app);
    console.log(
      `Processed ${result.processed} inputs, ${result.failed} failed`
    );
    await app.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

Run it with, for example, `npx ts-node scripts/content-automation-population.ts`.

You can run it again: inputs that were processed successfully are skipped. Inputs for which your strategy returned `false` or threw an error are offered to your strategy again.

## Dashboard

The plugin adds a **Content automation** page under the Catalog section of the Dashboard. It lists all updates of the active channel, with the strategy, language, result message and a link to the updated entity.

## Limitations

- The plugin only creates new jobs when the nightly task runs. When a job is still queued or retrying during the next nightly run, a second job is created for the same input. The second job is skipped if the first one succeeded, but if both jobs run at the same moment, content can be generated twice.
- Inputs that return `false` are offered to your strategy again on every run. Return `false` before doing expensive work, like calling an AI provider.
- `loadInputData()` returns all inputs of a channel and language at once, so they are all kept in memory during the run. Keep inputs small for very large catalogs.
- Only the latest successful state is retained per entity, strategy, channel and language. Previous generation results are overwritten.
