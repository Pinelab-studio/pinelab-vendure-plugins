# Vendure Content Automation Plugin

[Official documentation here](https://engineering.pinelab.studio/plugin/vendure-plugin-content-automation)

This plugin automates and checks the content of your Vendure catalog, for every channel and language. Checking and improving content usually go hand in hand, so both features live in one plugin, but you can enable each of them on its own:

- **Content automation** generates and enriches entity content, like SEO meta titles and descriptions, via your own strategies. It runs nightly in background jobs, skips inputs that haven't changed, and shows all updates in the Dashboard. The plugin doesn't include an AI provider, prompt format or content logic.
- **Content health** checks the rendered storefront pages and the catalog data of products and collections, for example for meta tags, hreflang, JSON-LD and sitemap inclusion. It shows the findings on product and collection pages, in a Dashboard widget, an alert and an issues list.

## Getting started

1. Add the plugin to your config, with the features you want to use. Vendure's scheduled tasks require a scheduler, so add `DefaultSchedulerPlugin` if you don't have one configured yet:

```ts
import { DefaultSchedulerPlugin } from '@vendure/core';
import { ContentAutomationPlugin } from '@pinelab/vendure-plugin-content-automation';

// In your plugins array, in vendure-config.ts
plugins: [
  ContentAutomationPlugin.init({
    // Omit to disable content automation
    automationStrategies: [new ProductMetaTagsAutomation()],
    // Omit to disable content health
    contentHealth: {
      getProductUrl: (ctx, { product, languageCode }) =>
        `https://storefront.example.com/${languageCode}/products/${product.slug}`,
      getCollectionUrl: (ctx, { collection, languageCode }) =>
        `https://storefront.example.com/${languageCode}/collections/${collection.slug}`,
    },
  }),
  DefaultSchedulerPlugin.init(),
];
```

2. Run a [database migration](https://docs.vendure.io/guides/developer-guide/migrations/) to add the `ContentAutomationUpdate` and `ContentCheckResult` entities. Both are always registered, also when a feature is disabled. If you just added `DefaultSchedulerPlugin`, the migration also adds the tables required by that plugin.
3. Give the `ContentAutomation` and/or `ContentHealth` permission to the roles that should see the Dashboard UI. SuperAdmins get them automatically. See [Dashboard](#dashboard).
4. For content automation: implement a strategy, see [Writing a strategy](#content-automation-writing-a-strategy), and run the [initial population](#content-automation-initial-population) once, before the first nightly run.
5. For content health: configure what to check, see [Content health checks](#content-health-checks) and [Content health options](#content-health-options).

A feature that isn't configured registers no Admin API, scheduled task or Dashboard permission. Passing neither `automationStrategies` nor `contentHealth` is valid, and does nothing.

## Upgrading to 1.0

Version 1.0 merges the `@pinelab/vendure-plugin-content-health` plugin into this plugin. The content health package is no longer maintained.

1. Remove `@pinelab/vendure-plugin-content-health` from your dependencies, and import from `@pinelab/vendure-plugin-content-automation` instead.
2. Move your options:

```ts
// Content automation only: no change
ContentAutomationPlugin.init({ automationStrategies });

// Content health only. Before: ContentHealthPlugin.init(contentHealthOptions)
ContentAutomationPlugin.init({ contentHealth: contentHealthOptions });

// Both. Before: ContentAutomationPlugin.init({ automationStrategies }) and ContentHealthPlugin.init(contentHealthOptions)
ContentAutomationPlugin.init({
  automationStrategies,
  contentHealth: contentHealthOptions,
});
```

3. Generate a database migration. If you used only one of the plugins, it creates the table of the other one. Existing tables, check results, stored strategy names and hashes are kept, so nothing is regenerated or rescanned.
4. Give the new `ContentAutomation` and `ContentHealth` permissions to every non-SuperAdmin role that should still see the Dashboard UI. The Admin API permissions haven't changed.

All content health options, callbacks, helpers, `additionalChecks`, events, Admin API operations and stored results are unchanged. The health constants are renamed to `CONTENT_HEALTH_OPTIONS` and `contentHealthLoggerCtx`, so they don't conflict with the automation constants.

## Content automation: writing a strategy

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
  // Optional: lets administrators run this strategy for a single product, from the product detail page
  entityType = 'product';

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
| `entityType`                                   | Optional. Set to `'product'` when the input ids are product ids, so the strategy runs when an administrator clicks [Run content automations](#manually-running-content-automation-for-a-product). Not used by the nightly run or the initial population.        |
| `loadInputData(ctx, injector)`                 | Called once per channel and language. Returns all inputs needed for generation. Inputs are passed to background jobs, so they have to be JSON serializable.                                                                                                     |
| `generateHash(ctx, input)`                     | Optional. Returns a deterministic fingerprint of the fields relevant for generation. By default, the plugin hashes all fields of the input, with sorted keys. Hashes longer than 191 characters are hashed again with SHA-256, so they fit the database column. |
| `generateAndSaveContent(ctx, injector, input)` | Generates the content and saves it to the entity. Use your own services, so validation, events and other side effects are applied. Return a result on success, `false` to deliberately skip, or throw for transient failures.                                   |

The result of `generateAndSaveContent` can have an optional `resultMessage` and an `entityUrl`. The `entityUrl` is a Dashboard route, like `/products/1`, and is used to link to the entity from the Dashboard.

The `ctx` passed to your strategy is an Admin API context for the channel and language being processed. There is no logged-in user, so don't rely on `ctx.activeUserId`.

### Important: what to include in the input

- **Include the id of the entity.** Every input must contain `id: ID`. The plugin compares its hash against the latest successful update for that entity, strategy, channel and language. Reverting to an older input regenerates content.
- **Don't include fields your strategy writes.** If the input of the meta tags strategy would include the meta title, every generation changes the input, and the product would be regenerated every night.

## Content automation: how it works

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

To turn off the nightly run, set `nightlyAutomation: false`. The `content-automation` task is then not registered, while the Admin API, [manual runs](#manually-running-content-automation-for-a-product) and the [initial population](#content-automation-initial-population) keep working. For a temporary pause, you can instead disable the task on the Scheduled Tasks page of the Dashboard: that setting is stored in the database of that environment.

```ts
ContentAutomationPlugin.init({
  automationStrategies: [new ProductMetaTagsAutomation()],
  nightlyAutomation: false,
});
```

Job data is fully serializable, so it also works with job queues that pass jobs over HTTP, like the [Google Cloud Tasks plugin](https://engineering.pinelab.studio/plugin/vendure-plugin-google-cloud-tasks).

## Manually running content automation for a product

The SEO / content checks block on the product detail page has a **Run content automations** button. It runs every strategy with `entityType: 'product'` for that product, in every language of the active channel. Because the button lives in the content health block, it's only available when content health is enabled too, and only shown to administrators with the `ContentAutomation` permission.

- Content is always regenerated, also when the input didn't change since the last generation.
- Each strategy and language becomes a background job, with the same retries and stored results as the nightly run. The button reports how many jobs were queued; the results appear on the Content automation page once the jobs are done.
- Strategies don't load a single product: `loadInputData()` is called as usual, and only the input with the product's id is used. One click therefore loads the inputs of all products, once per strategy and language.

The button uses this mutation, which requires the `UpdateProduct` permission:

```graphql
mutation {
  runContentAutomationForProduct(productId: "1") {
    jobsCreated
  }
}
```

## Content automation: stored state

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

## Content automation: initial population

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

## Content health checks

### Storefront checks

The plugin fetches each rendered storefront page (following redirects) and checks that the resolved URL is in the sitemap returned by `getSitemapUrl`. What the HTML must contain is up to you: pass a `validateStorefront` strategy, which receives the server-rendered HTML for every successfully fetched page. No HTML validation runs without it.

```ts
import {
  checkMetaDescriptionLength,
  checkMetaTitleLength,
  extractMetaDescription,
  extractTitle,
  validateHreflang,
  validateJsonLd,
} from '@pinelab/vendure-plugin-content-automation';

ContentAutomationPlugin.init({
  contentHealth: {
    // ...
    validateStorefront: async (
      ctx,
      { entityType, channel, url, html, fetchPage }
    ) => [
      ...checkMetaTitleLength(extractTitle(html)),
      ...checkMetaDescriptionLength(extractMetaDescription(html)),
      ...validateJsonLd(html, entityType),
      ...(await validateHreflang({
        html,
        pageUrl: url,
        enabledLanguageCodes: channel.availableLanguageCodes,
        fetchPage,
      })),
    ],
  },
});
```

`validateStorefront(ctx, args)` receives `entityType`, `entity`, `channel`, `languageCode`, `url` (from `getProductUrl`/`getCollectionUrl`), `finalUrl` (after redirects), `html`, and `fetchPage(url)`. `fetchPage` fetches other pages, e.g. hreflang alternates or internal links, with the plugin's redirect and timeout settings. Its results are cached by URL per channel during a full scan, so each URL is requested once per channel. A failed fetch includes the final HTTP `status` and `finalUrl` when a response was received, so you can tell a (redirected) 404 apart from a timeout. Throwing from `validateStorefront` is recorded as an internal error finding.

Opt-in helpers:

| Helper                                                                 | What it validates                                                                                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkMetaTitleLength(extractTitle(html))`                             | A `<title>` exists and is 30-60 characters long.                                                                                                                        |
| `checkMetaDescriptionLength(extractMetaDescription(html))`             | A `<meta name="description">` exists and is 100-160 characters long.                                                                                                    |
| `validateHreflang({ html, pageUrl, enabledLanguageCodes, fetchPage })` | Every enabled language and `x-default` are linked, including reciprocal links between translated pages.                                                                 |
| `validateJsonLd(html, entityType)`                                     | JSON-LD blocks are valid JSON. Products include `Product`, `ProductGroup`, `BreadcrumbList`, and `Organization` or `OnlineStore`; collections include `BreadcrumbList`. |
| `extractLinks(html, pageUrl)`                                          | Not a check: returns the page's absolute `<a href>` URLs, e.g. to check internal links with `fetchPage`.                                                                |

### Configurable Vendure checks

Use `checks.product` and `checks.collection` to validate Vendure data that is specific to your project. No Vendure-data checks are enabled by default. The configuration example below demonstrates how to report missing or incomplete translations without being misled by Vendure's default-language fallback.

For other content types, such as CMS entries, use [`additionalChecks`](#additionalchecks-custom-entities).

Only the latest result per entity, channel, and language is kept. A new check replaces the previous result; no history is stored.

## Content health options

```ts
import { ContentAutomationPlugin } from '@pinelab/vendure-plugin-content-automation';

plugins: [
  ContentAutomationPlugin.init({
    contentHealth: {
      // Required: resolve the storefront URL for a product, given the channel and language.
      // Kept separate from `getCollectionUrl` since products and collections often follow
      // different URL structures (e.g. a flat product path vs. a nested category tree).
      // Returning `undefined` for an eligible product is recorded as an error, not silently skipped.
      getProductUrl: (ctx, { product, languageCode }) =>
        `https://storefront.example.com/${languageCode}/products/${product.slug}`,
      // Required: resolve the storefront URL for a collection, given the channel and language.
      getCollectionUrl: (ctx, { collection, languageCode }) =>
        `https://storefront.example.com/${languageCode}/collections/${collection.slug}`,
      // Optional: resolve the sitemap to check URL inclusion against, per channel/language.
      // Omit (or return `undefined`) to skip the sitemap-inclusion check for a channel/language.
      getSitemapUrl: (ctx, { channel, languageCode }) =>
        `https://storefront.example.com/${languageCode}/sitemap.xml`,
      // Optional: determines whether an entity is eligible for checks at all.
      // Apply your own business rules here (e.g. a `hidden` or
      // `onlyDisplayAfterDate` custom field) — omit to check everything.
      shouldCheckEntity: (ctx, entity) =>
        'enabled' in entity ? entity.enabled : !entity.isPrivate,
      // Optional, defaults shown:
      maxRedirects: 5,
      requestTimeoutMs: 10000,
      concurrency: 5,
      // Optional: change when the full scan runs (default: nightly at 3:00 AM).
      scheduledTask: { schedule: (cron) => cron.everyDayAt(4, 0) },
      // Optional: your own checks against Vendure catalog data, for products and
      // collections specifically. For any other kind of content, see `additionalChecks`.
      checks: {
        product: [
          (ctx, { product }) => {
            const translation = product.translations.find(
              ({ languageCode }) => languageCode === ctx.languageCode
            );
            if (translation?.name.trim() && translation.description.trim()) {
              return [];
            }
            return [
              {
                source: 'translation',
                severity: 'error',
                code: 'TRANSLATION_MISSING',
                message: `Product has no complete translation for language '${ctx.languageCode}'.`,
              },
            ];
          },
        ],
        collection: [],
      },
      // Optional: checks for content that isn't a product or collection at all.
      // See "additionalChecks: custom entities" below.
      additionalChecks: [],
    },
  }),
];
```

Every strategy function (`getProductUrl`, `getCollectionUrl`, `validateStorefront`, `checks`, `additionalChecks`) receives the `RequestContext`, so behaviour — including the resolved URL — can differ per channel. `checks.product` and `checks.collection` functions also receive an `injector`, to use Vendure services or the database, e.g. for relations that aren't loaded on the entity.

### Checking for missing translations

The custom product check above shows how to detect missing or incomplete translations. Vendure falls back to the channel's default translation when the requested translation does not exist, so checking only `product.name` or `product.description` can incorrectly look valid. Instead, find the entry in `product.translations` matching `ctx.languageCode` and report a finding when that translation is absent or a required translated field is blank. This example considers both `name` and `description` required; adapt the fields and severity to your storefront's requirements. Translation validation is not a built-in check and must be configured through `checks` as shown.

## Entity eligibility

The plugin doesn't own any field for excluding a product or collection from checks — that would collide with whatever business rules you already use to mark something as hidden or not-yet-live (a `hidden` flag, an `onlyDisplayAfterDate` field, etc.). Instead, supply a `shouldCheckEntity(ctx, entity)` function. When it resolves `false`, scheduled and on-demand full scans omit the entity entirely. A manual or update-triggered per-entity check stores only an `ENTITY_EXCLUDED` warning for each enabled language, replacing any previous findings; this warning is visible on the entity but intentionally omitted from the global SEO/content issues list. Omit `shouldCheckEntity` (the default) to check every product and collection.

## Content health triggers

- **Scheduled full scan**: registered as a `ScheduledTask` (id `content-health-full-scan`), checking every eligible product and collection (see [Entity eligibility](#entity-eligibility)) across every enabled channel and language. Runnable on demand via Vendure's built-in Scheduled Tasks admin screen. Runs at 03:00 by default, after content automation (see [Nightly schedule order](#nightly-schedule-order)). Requires a scheduler plugin (e.g. `DefaultSchedulerPlugin`) to actually run on a schedule.
- **Per-entity check on update**: whenever a product or collection is updated, it is automatically re-checked across all of its resolved channel/language combinations — no action needed.
- **Manual check, per entity**: a "Check now" button on the product/collection detail page (in the findings block) re-checks just that entity on demand, without needing to edit it. Backed by the `runContentCheckForProduct`/`runContentCheckForCollection` mutations (`Permission.UpdateProduct`/`Permission.UpdateCollection`). Unlike the automatic recheck on update — which re-checks every channel the entity belongs to, since editing shared content can affect the outcome everywhere it's used — the manual check is scoped to the active channel only, so triggering it from Channel A never reads or writes results for Channel B.
- **Manual check, full catalog**: a "Run full scan now" button on the "SEO / content issues" dashboard page. Backed by the `runContentHealthFullScan` mutation (`Permission.UpdateCatalog`), which awaits the same `runFullScan()` used by the scheduled task. On a very large catalog this may take a while and could exceed typical HTTP/GraphQL request timeouts — for large catalogs, prefer the Scheduled Tasks admin screen's "Run" action instead, since that execution isn't bound by a request timeout.

Root collections (`isRoot: true`) are skipped, since they don't correspond to a real storefront page.

## `additionalChecks`: custom entities

`checks.product`/`checks.collection` are deliberately limited to Vendure's built-in products and collections — that keeps the common case simple for anyone already used to Vendure. For content that isn't a product or collection at all (a CMS entry managed by another plugin, a landing page, anything else stored in the Vendure DB), register an `additionalChecks` function instead:

```ts
additionalChecks: [
  async (ctx, injector) => {
    const connection = injector.get(TransactionalConnection);
    const entries = await connection
      .getRepository(ctx, MyCmsEntry)
      .find();
    return entries
      .filter((entry) => !entry.metaTitle)
      .map((entry) => ({
        entityType: 'cms-content-entry',
        entityId: entry.id,
        label: entry.title,
        url: `/cms-content-entries/${entry.id}`,
        messages: [
          {
            source: 'cms-meta-title-check',
            severity: 'warning',
            code: 'CMS_ENTRY_MISSING_META_TITLE',
            message: 'This CMS entry has no meta title set.',
          },
        ],
      }));
  },
],
```

Unlike `checks.product`/`checks.collection`, an `additionalChecks` function isn't scoped to an existing entity — it receives an `Injector` (so it can fetch anything from the Vendure DB, or from another plugin's own service, for the given channel) and is fully responsible for finding whatever it wants to check and reporting its own `entityType`, `entityId`, `label`, and (optionally) `url` for every result. `entityType` must not be `'product'`/`'collection'` (those are reserved for the built-in pipeline) — and avoid `'PRODUCT'`/`'COLLECTION'` too: those aren't treated as core internally, but since only the two lowercase values get uppercased for display, a custom type spelled that way would show up in the Admin API/dashboard indistinguishable from a real product or collection. `entityId` isn't required to be a Vendure-style numeric/encoded id — any string is fine, since it's only ever round-tripped back through this plugin's own API, not Vendure's core entity-id codec.

It runs once per channel during a full scan (scheduled or on-demand); it is not triggered by a per-entity update event (Vendure has no generic "custom entity updated" event to hook into), and there is no per-entity manual "Check now" mutation for it — only a full-scan re-check picks up changes.

## Content health event

`ChannelContentScanCompletedEvent` is published once per channel at the end of a full scan (not for per-entity update-triggered checks), carrying that channel's findings for every language and entity checked during the scan — including page-fetch and sitemap failures, and `additionalChecks` results. Subscribe to it to build things like an email report, without polling the stored results:

```ts
eventBus
  .ofType(ChannelContentScanCompletedEvent)
  .subscribe(({ channel, findings }) => {
    // findings: Array<{ entityType, entityId, languageCode, url, hasError, hasWarning, messages, checkedAt }>
    // entityType is 'product' | 'collection' for the built-in pipeline, or
    // whatever free-form string an `additionalChecks` function chose.
  });
```

## Content health Admin API

- `contentCheckResults(entityType: String!, entityId: String!): [ContentCheckResult!]!` — latest results for a single entity, scoped to the active channel, across every language it was checked in. `entityType` is `'PRODUCT'`/`'COLLECTION'` for the built-in pipeline, or whatever custom string an `additionalChecks` function chose. Results carry `label`/`url`, which are only populated for custom entity types (product/collection names and URLs are always resolved live instead).
- `contentCheckOverview(options: ContentCheckOverviewListOptions): ContentCheckOverviewList!` — a standard Vendure paginated list of every entity in the active channel with at least one current warning or error. One row per entity (deduplicated across languages), with `url`, `errorCount`, `warningCount`, `languageCodes`, and a `preview` of the first error (or first warning) message. Supports `filter: { name, entityType, hasError, hasWarning }`, `sort`, `skip`/`take` like any other Vendure list query.
- `contentCheckEntityTypes: [String!]!` — every distinct `entityType` that currently has at least one entity with a warning or error in the active channel. Powers the issues list's "Type" filter, so a custom `additionalChecks` entity type shows up there automatically instead of requiring the filter options to be predefined.
- `runContentCheckForProduct(productId: ID!): [ContentCheckResult!]!` — manually re-checks a single product now and returns its fresh results.
- `runContentCheckForCollection(collectionId: ID!): [ContentCheckResult!]!` — manually re-checks a single collection now and returns its fresh results.
- `runContentHealthFullScan: ContentHealthScanResult!` — manually runs a full scan now, the same as the scheduled task.

## Fixing storefront findings

| Finding           | How to fix                                                                                                                                                                                        | Typical owner                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Meta title        | Write a descriptive SEO title of 30-60 characters (50-60 recommended). If Vendure has no SEO-title field or the storefront does not render it as `<title>`, add that field or mapping first.      | Usually a content editor once the field is available; otherwise a storefront developer.                               |
| Meta description  | Write a useful page summary of 100-160 characters (140-160 recommended). If the field is unavailable or is not rendered as `<meta name="description">`, update the storefront integration.        | Usually a content editor once the field is available; otherwise a storefront developer.                               |
| Hreflang          | Render absolute `<link rel="alternate" hreflang="…">` tags for every enabled language, reciprocal links on each translated page, and an `x-default` link. Also ensure the translated pages exist. | Primarily a storefront developer; content editors may need to publish missing translations.                           |
| JSON-LD           | Add or correct `<script type="application/ld+json">` generation and populate it from Vendure data. Content editors can then complete any missing source data.                                     | Storefront developer, with content-editor follow-up for incomplete data.                                              |
| Sitemap inclusion | Ensure the page is published and indexable, its canonical URL matches the sitemap URL, and the storefront sitemap is regenerated correctly.                                                       | Usually a storefront developer or technical SEO/operations owner; an editor may need to publish or enable the entity. |

## Nightly schedule order

The content automation task (`content-automation`) runs at 02:00, and the content health scan (`content-health-full-scan`) at 03:00, so the scan usually sees the content generated that night. This is ordering by clock only:

- The automation task only creates jobs. The health scan doesn't wait for them, so with a long queue, the scan can run while content is still being generated.
- Product and collection updates are checked right away, also when they are saved by an automation strategy. These checks aren't affected by the schedule.
- If you change either schedule, via `contentAutomationTask.configure()` or `contentHealth.scheduledTask`, keep the health scan after the automation task yourself.

## Dashboard

The Dashboard UI of a feature is only shown to administrators with that feature's permission in the active channel: `ContentAutomation` or `ContentHealth`. A feature that isn't configured doesn't register its permission, so its UI is hidden for everyone. SuperAdmins get all registered permissions automatically. The permissions only control what the Dashboard shows: the Admin API keeps its own permission requirements, like `ReadCatalog`. When you disable a feature, also remove its permission from your roles.

Content automation adds a **Content automation** page under the Catalog section. It lists all updates of the active channel, with the strategy, language, result message and a link to the updated entity.

Content health adds:

- A findings block on the product/collection detail page, with a "Check now" button. On products, it also has a "Run content automations" button when content automation is enabled, see [Manually running content automation for a product](#manually-running-content-automation-for-a-product).
- A dashboard-home overview widget, linking through to the full issues page.
- A full, filterable, paginated **"SEO / content issues" list page** under the Catalog nav section (`/content-health/issues`), listing every entity with a current warning or error — deduplicated across every language it was checked in, with an error/warning count, a message preview, and the affected languages. Supports searching by name and filtering by type and severity (errors vs. warnings-only). Each row has a "Go to entity" button for direct navigation (to the product/collection detail page for the built-ins, or the URL the `additionalChecks` result provided for a custom entity type — hidden if none was given), and clicking the name goes to this plugin's own **issue detail page** (`/content-health/issues/:entityType/:entityId`), which shows the entity's full findings across every checked language and its own "Go to entity" link. For products/collections, a "Check now" button re-checks the entity on demand, and a deleted entity is shown with a "could not be found" state rather than a broken link; a blank/whitespace-only name falls back to `Untitled product #<id>` / `Untitled collection #<id>`. Custom entity types (from `additionalChecks`) have no "Check now" button — see [below](#additionalchecks-custom-entities) — and use the `label` captured at check time instead, falling back to `Untitled <entityType> #<id>` if blank.
- An error-only alert, also linking through to the issues list.

## Limitations

- The plugin only creates new jobs when the nightly task runs, or when content automation is run manually for a product. When a job is still queued or retrying during the next nightly run, a second job is created for the same input. The second job is skipped if the first one succeeded, but if both jobs run at the same moment, content can be generated twice.
- Inputs that return `false` are offered to your strategy again on every run. Return `false` before doing expensive work, like calling an AI provider.
- `loadInputData()` returns all inputs of a channel and language at once, so they are all kept in memory during the run. Keep inputs small for very large catalogs.
- Only the latest successful state is retained per entity, strategy, channel and language. Previous generation results are overwritten.
- The "Run content automations" button is only available on products, and only when content health is enabled, because it's part of the content checks block.
- The Dashboard permissions only hide navigation items, blocks, widgets and alerts. A page of a disabled feature can still be opened by its URL, but its Admin API calls then fail.
