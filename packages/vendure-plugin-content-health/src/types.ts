import {
  Channel,
  Collection,
  ID,
  Injector,
  LanguageCode,
  Product,
  RequestContext,
  ScheduledTaskConfig,
} from '@vendure/core';

/**
 * @description
 * The kind of catalog entity a content check result belongs to, for the
 * built-in product/collection scan pipeline. `additionalChecks` results are
 * not constrained to this — they carry their own free-form `entityType`
 * string.
 */
export type ContentCheckEntityType = 'product' | 'collection';

/**
 * @description
 * The severity of a single {@link ContentCheckMessage}.
 */
export type ContentCheckSeverity = 'warning' | 'error';

/** Stable code used when `shouldCheckEntity` excludes an entity. */
export const ENTITY_EXCLUDED_CODE = 'ENTITY_EXCLUDED';

/**
 * @description
 * A single finding produced by a built-in or configurable content check.
 */
export interface ContentCheckMessage {
  /**
   * The check that produced this message, e.g. `meta-title` or `hreflang`.
   * For configurable checks, this defaults to `configurable-check`.
   */
  source: string;
  severity: ContentCheckSeverity;
  /**
   * A stable machine-readable code identifying the kind of violation,
   * e.g. `META_TITLE_LENGTH`.
   */
  code: string;
  message: string;
}

/**
 * @description
 * The arguments passed to a product-scoped `ContentCheck`, `getProductUrl`.
 */
export interface ProductCheckArgs {
  product: Product;
  channel: Channel;
  languageCode: LanguageCode;
}

/**
 * @description
 * The arguments passed to a collection-scoped `ContentCheck`,
 * `getCollectionUrl`.
 */
export interface CollectionCheckArgs {
  collection: Collection;
  channel: Channel;
  languageCode: LanguageCode;
}

/**
 * @description
 * A site-owner-supplied check against a product's Vendure catalog data (as
 * opposed to the built-in storefront page checks, which operate on the
 * rendered HTML).
 *
 * Return zero or more messages. Throwing is caught by the pipeline and
 * turned into a single internal error message; it does not abort the scan.
 */
export type ProductContentCheck = (
  ctx: RequestContext,
  args: ProductCheckArgs
) => Promise<ContentCheckMessage[]> | ContentCheckMessage[];

/**
 * @description
 * A site-owner-supplied check against a collection's Vendure catalog data.
 * See {@link ProductContentCheck}.
 */
export type CollectionContentCheck = (
  ctx: RequestContext,
  args: CollectionCheckArgs
) => Promise<ContentCheckMessage[]> | ContentCheckMessage[];

/**
 * @description
 * A single entry of a channel's scan findings, as published on
 * {@link ChannelContentScanCompletedEvent}. Shaped like a
 * `ContentCheckResult` row.
 */
export interface ChannelScanFindingEntry {
  entityType: string;
  entityId: ID;
  languageCode: LanguageCode;
  url?: string;
  hasError: boolean;
  hasWarning: boolean;
  messages: ContentCheckMessage[];
  checkedAt: Date;
}

/**
 * @description
 * A single result produced by an {@link AdditionalContentCheck}, for
 * content the plugin has no built-in concept of (e.g. a custom Vendure
 * entity managed by another plugin, such as a CMS content entry).
 */
export interface AdditionalCheckResult {
  /**
   * A free-form label identifying the kind of custom entity this result is
   * for, e.g. `'cms-content-entry'`. Shown in the dashboard's "Type" column.
   * Must not be `'product'` or `'collection'` (those are reserved for the
   * built-in scan pipeline).
   */
  entityType: string;
  entityId: ID;
  /**
   * Display name shown in the dashboard overview and issue detail page.
   * Unlike products/collections, the plugin has no generic way to look this
   * up live, so it's captured here and stored alongside the result.
   */
  label: string;
  /**
   * Optional URL for the dashboard's "Go to entity" button — typically your
   * own plugin's admin detail page, since the plugin has no generic way to
   * build one for a custom entity. Omit to hide the button.
   */
  url?: string;
  /**
   * @default the channel's default language
   */
  languageCode?: LanguageCode;
  messages: ContentCheckMessage[];
}

/**
 * @description
 * A site-owner-supplied check for content the plugin has no built-in
 * concept of. Unlike `checks.product`/`checks.collection`, this isn't
 * scoped to an existing product/collection: the function receives an
 * `Injector` (so it can fetch anything from the Vendure DB, or from another
 * plugin's own service, for the given channel) and is fully responsible for
 * finding whatever it wants to check and reporting its own entity type, id,
 * label, and (optionally) URL.
 *
 * Runs once per channel during a full scan (scheduled or on-demand); it is
 * not triggered by a per-entity update event, since Vendure has no generic
 * "custom entity updated" event to hook into, and there is no per-entity
 * manual "Check now" mutation for it.
 */
export type AdditionalContentCheck = (
  ctx: RequestContext,
  injector: Injector
) => Promise<AdditionalCheckResult[]> | AdditionalCheckResult[];

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface ContentHealthPluginOptions {
  /**
   * @description
   * Resolves the storefront URL for a given product, channel and language.
   * Returning `undefined` for a non-excluded product is treated as an
   * unresolvable-URL error, not a silent skip.
   */
  getProductUrl: (
    ctx: RequestContext,
    args: ProductCheckArgs
  ) => string | undefined | Promise<string | undefined>;
  /**
   * @description
   * Resolves the storefront URL for a given collection, channel and
   * language. Kept separate from `getProductUrl` since collection URLs
   * often follow a different structure (e.g. a category tree path).
   * Returning `undefined` for a non-excluded collection is treated as an
   * unresolvable-URL error, not a silent skip.
   */
  getCollectionUrl: (
    ctx: RequestContext,
    args: CollectionCheckArgs
  ) => string | undefined | Promise<string | undefined>;
  /**
   * @description
   * Resolves the sitemap URL to check URL inclusion against, for a given
   * channel and language. When omitted (or when it resolves to `undefined`
   * for a given channel/language), the sitemap-inclusion check is skipped
   * for that channel/language.
   */
  getSitemapUrl?: (
    ctx: RequestContext,
    args: { channel: Channel; languageCode: LanguageCode }
  ) => string | undefined | Promise<string | undefined>;
  /**
   * @description
   * The maximum number of redirects to follow when fetching a storefront
   * page. Any final response with a 2xx status is treated as success.
   *
   * @default 5
   */
  maxRedirects?: number;
  /**
   * @description
   * Timeout in milliseconds for fetching storefront pages and sitemaps.
   *
   * @default 10000
   */
  requestTimeoutMs?: number;
  /**
   * @description
   * The number of entity/channel/language combinations to check
   * concurrently during a full scan.
   *
   * @default 5
   */
  concurrency?: number;
  /**
   * @description
   * The full scan is always registered as a `ScheduledTask`. Use this to
   * change when it runs, or its timeout. Defaults to nightly at 3:00 AM.
   */
  scheduledTask?: Partial<Pick<ScheduledTaskConfig, 'schedule' | 'timeout'>>;
  /**
   * @description
   * Site-owner-supplied Vendure content checks, for products and
   * collections specifically. No built-in Vendure-data checks ship with the
   * plugin, so an empty/omitted list is valid. For content that isn't a
   * product or collection, see `additionalChecks`.
   */
  checks?: {
    product?: ProductContentCheck[];
    collection?: CollectionContentCheck[];
  };
  /**
   * @description
   * Site-owner-supplied checks for custom content the plugin has no
   * built-in concept of — e.g. CMS content managed by another plugin. See
   * {@link AdditionalContentCheck}.
   */
  additionalChecks?: AdditionalContentCheck[];
  /**
   * @description
   * Determines whether a given product or collection is eligible for
   * content/SEO checks. Use this to apply your own business rules for
   * excluding entities (e.g. a `hidden` or `onlyDisplayAfterDate` custom
   * field) rather than relying on a field owned by this plugin. Excluded
   * entities are omitted from scheduled/on-demand full scans. A manual or
   * update-triggered per-entity check instead replaces the entity's current
   * results with an `ENTITY_EXCLUDED` warning for each enabled language.
   * When omitted, every product and collection is eligible.
   */
  shouldCheckEntity?: (
    ctx: RequestContext,
    entity: Product | Collection
  ) => boolean | Promise<boolean>;
}
