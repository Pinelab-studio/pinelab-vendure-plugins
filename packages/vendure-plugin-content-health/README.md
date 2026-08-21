# Vendure content / SEO monitor plugin

Validates Vendure catalog data and the actual rendered storefront output for products and collections, and surfaces the results in the dashboard detail pages of products and collections.

## What it checks

- The plugin runs five built-in checks against the storefront page's rendered HTML (fetched with a plain HTTP GET, following redirects): See table below
- On top of that, you can register your own **Vendure content checks** — checks against Vendure catalog data itself (as opposed to the rendered page) — via the `checks` option. No built-in Vendure-data checks ship with the plugin.

| Check             | What a finding means                                                                                                                                                                                                      | How to fix it                                                                                                                                                                                                                                               | Typical owner                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Meta title        | The rendered page has no `<title>`, or its title is outside the valid 30-60 character range (50-60 is recommended).                                                                                                       | Edit the product/collection SEO title to be descriptive and within the recommended range. If Vendure has no SEO-title field, or the storefront does not render it as `<title>`, add that field/mapping to the storefront first.                             | Usually a content editor once the storefront supports an SEO-title field; otherwise a storefront developer.           |
| Meta description  | The rendered page has no `<meta name="description">`, or its content is outside the valid 100-160 character range (140-160 is recommended).                                                                               | Write a useful page summary within the recommended range. If the field is not available or is not rendered into the meta tag, the storefront integration must be updated.                                                                                   | Usually a content editor once the field is wired up; otherwise a storefront developer.                                |
| Hreflang          | The page does not link to every language enabled for the Vendure channel, lacks an `x-default` link, or a linked translated page does not link back.                                                                      | Render a complete set of absolute `<link rel="alternate" hreflang="…">` tags on every translated version, including reciprocal links and `x-default`. Content editors should ensure translations/pages exist, but tag generation belongs in the storefront. | Primarily a storefront developer; content editors may need to publish the missing translations.                       |
| JSON-LD           | Required schema.org types are missing from the rendered JSON-LD. Products require `Product`, `ProductGroup`, `BreadcrumbList`, and at least one of `Organization` or `OnlineStore`; collections require `BreadcrumbList`. | Add or correct `<script type="application/ld+json">` generation in the storefront and populate it from Vendure data. Editors can correct missing source data after this is implemented, but cannot fix absent JSON-LD rendering themselves.                 | Storefront developer, with content-editor follow-up for incomplete product data.                                      |
| Sitemap inclusion | The resolved storefront URL is absent from the sitemap returned by the configured `getSitemapUrl`.                                                                                                                        | Ensure the page is publishable/indexable, its canonical URL matches the URL emitted by the sitemap, and regenerate or fix the storefront sitemap.                                                                                                           | Usually a storefront developer or technical SEO/operations owner; an editor may need to publish or enable the entity. |

For content that isn't a product or collection at all (e.g. CMS entries managed by another plugin), see [`additionalChecks`](#additionalchecks-custom-entities) below.

Only the latest result per (entity, channel, language) is kept; a new check fully replaces the previous one. No history/trend data is stored.

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
          if (!product.description || product.description.length < 20) {
            return [
              {
                source: 'my-description-check',
                severity: 'warning',
                code: 'PRODUCT_DESCRIPTION_TOO_SHORT',
                message:
                  'Product description should be at least 20 characters long.',
              },
            ];
          }
          return [];
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
