# Vendure content / SEO monitor plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-content-health)

Monitor Vendure products and collections for storefront SEO and content issues.

## Checks

### Built-in storefront checks

The plugin fetches each rendered storefront page and runs these checks automatically:

| Check             | What it validates                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Meta title        | A `<title>` exists and is 30-60 characters long.                                                                                         |
| Meta description  | A `<meta name="description">` exists and is 100-160 characters long.                                                                     |
| Hreflang          | Every channel language and `x-default` are linked, including reciprocal links between translated pages.                                  |
| JSON-LD           | Products include `Product`, `ProductGroup`, `BreadcrumbList`, and `Organization` or `OnlineStore`; collections include `BreadcrumbList`. |
| Sitemap inclusion | The resolved storefront URL exists in the sitemap returned by `getSitemapUrl`.                                                           |

### Configurable Vendure checks

Use `checks.product` and `checks.collection` to validate Vendure data that is specific to your project. No Vendure-data checks are enabled by default. The configuration example below demonstrates how to report missing or incomplete translations without being misled by Vendure's default-language fallback.

For other content types, such as CMS entries, use [`additionalChecks`](#additionalchecks-custom-entities).

Only the latest result per entity, channel, and language is kept. A new check replaces the previous result; no history is stored.

## Getting started

```ts
import { ContentHealthPlugin } from '@pinelab/vendure-plugin-content-health';

plugins: [
  ContentHealthPlugin.init({
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
  }),
];
```

Every strategy function (`getProductUrl`, `getCollectionUrl`, `checks`, `additionalChecks`) receives the `RequestContext`, so behaviour — including the resolved URL — can differ per channel.

### Checking for missing translations

The custom product check above shows how to detect missing or incomplete translations. Vendure falls back to the channel's default translation when the requested translation does not exist, so checking only `product.name` or `product.description` can incorrectly look valid. Instead, find the entry in `product.translations` matching `ctx.languageCode` and report a finding when that translation is absent or a required translated field is blank. This example considers both `name` and `description` required; adapt the fields and severity to your storefront's requirements. Translation validation is not a built-in check and must be configured through `checks` as shown.

The dashboard extensions are provided as a React Dashboard extension — no Admin UI compilation step is needed:

- A findings block on the product/collection detail page, with a "Check now" button.
- A dashboard-home overview widget, linking through to the full issues page.
- A full, filterable, paginated **"SEO / content issues" list page** under the Catalog nav section (`/content-health/issues`), listing every entity with a current warning or error — deduplicated across every language it was checked in, with an error/warning count, a message preview, and the affected languages. Supports searching by name and filtering by type and severity (errors vs. warnings-only). Each row has a "Go to entity" button for direct navigation (to the product/collection detail page for the built-ins, or the URL the `additionalChecks` result provided for a custom entity type — hidden if none was given), and clicking the name goes to this plugin's own **issue detail page** (`/content-health/issues/:entityType/:entityId`), which shows the entity's full findings across every checked language and its own "Go to entity" link. For products/collections, a "Check now" button re-checks the entity on demand, and a deleted entity is shown with a "could not be found" state rather than a broken link; a blank/whitespace-only name falls back to `Untitled product #<id>` / `Untitled collection #<id>`. Custom entity types (from `additionalChecks`) have no "Check now" button — see [below](#additionalchecks-custom-entities) — and use the `label` captured at check time instead, falling back to `Untitled <entityType> #<id>` if blank.
- An error-only alert, also linking through to the issues list.

## Entity eligibility

The plugin doesn't own any field for excluding a product or collection from checks — that would collide with whatever business rules you already use to mark something as hidden or not-yet-live (a `hidden` flag, an `onlyDisplayAfterDate` field, etc.). Instead, supply a `shouldCheckEntity(ctx, entity)` function. When it resolves `false`, scheduled and on-demand full scans omit the entity entirely. A manual or update-triggered per-entity check stores only an `ENTITY_EXCLUDED` warning for each enabled language, replacing any previous findings; this warning is visible on the entity but intentionally omitted from the global SEO/content issues list. Omit `shouldCheckEntity` (the default) to check every product and collection.

## Triggers

- **Scheduled full scan**: registered as a `ScheduledTask` (id `content-health-full-scan`), checking every eligible product and collection (see [Entity eligibility](#entity-eligibility)) across every enabled channel and language. Runnable on demand via Vendure's built-in Scheduled Tasks admin screen. Requires a scheduler plugin (e.g. `DefaultSchedulerPlugin`) to actually run on a schedule.
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

## Event

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

## Admin API

- `contentCheckResults(entityType: String!, entityId: String!): [ContentCheckResult!]!` — latest results for a single entity, scoped to the active channel, across every language it was checked in. `entityType` is `'PRODUCT'`/`'COLLECTION'` for the built-in pipeline, or whatever custom string an `additionalChecks` function chose. Results carry `label`/`url`, which are only populated for custom entity types (product/collection names and URLs are always resolved live instead).
- `contentCheckOverview(options: ContentCheckOverviewListOptions): ContentCheckOverviewList!` — a standard Vendure paginated list of every entity in the active channel with at least one current warning or error. One row per entity (deduplicated across languages), with `url`, `errorCount`, `warningCount`, `languageCodes`, and a `preview` of the first error (or first warning) message. Supports `filter: { name, entityType, hasError, hasWarning }`, `sort`, `skip`/`take` like any other Vendure list query.
- `contentCheckEntityTypes: [String!]!` — every distinct `entityType` that currently has at least one entity with a warning or error in the active channel. Powers the issues list's "Type" filter, so a custom `additionalChecks` entity type shows up there automatically instead of requiring the filter options to be predefined.
- `runContentCheckForProduct(productId: ID!): [ContentCheckResult!]!` — manually re-checks a single product now and returns its fresh results.
- `runContentCheckForCollection(collectionId: ID!): [ContentCheckResult!]!` — manually re-checks a single collection now and returns its fresh results.
- `runContentHealthFullScan: ContentHealthScanResult!` — manually runs a full scan now, the same as the scheduled task.

## Fixing built-in findings

| Finding           | How to fix                                                                                                                                                                                        | Typical owner                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Meta title        | Write a descriptive SEO title of 30-60 characters (50-60 recommended). If Vendure has no SEO-title field or the storefront does not render it as `<title>`, add that field or mapping first.      | Usually a content editor once the field is available; otherwise a storefront developer.                               |
| Meta description  | Write a useful page summary of 100-160 characters (140-160 recommended). If the field is unavailable or is not rendered as `<meta name="description">`, update the storefront integration.        | Usually a content editor once the field is available; otherwise a storefront developer.                               |
| Hreflang          | Render absolute `<link rel="alternate" hreflang="…">` tags for every enabled language, reciprocal links on each translated page, and an `x-default` link. Also ensure the translated pages exist. | Primarily a storefront developer; content editors may need to publish missing translations.                           |
| JSON-LD           | Add or correct `<script type="application/ld+json">` generation and populate it from Vendure data. Content editors can then complete any missing source data.                                     | Storefront developer, with content-editor follow-up for incomplete data.                                              |
| Sitemap inclusion | Ensure the page is published and indexable, its canonical URL matches the sitemap URL, and the storefront sitemap is regenerated correctly.                                                       | Usually a storefront developer or technical SEO/operations owner; an editor may need to publish or enable the entity. |
