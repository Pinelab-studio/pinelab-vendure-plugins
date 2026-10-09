# Vendure Better Search Plugin

In-memory storefront search with fuzzy matching, powered by MiniSearch by default. Intended for small to medium-sized shops with around 10,000 variants; capacity depends on your data and resources. A lightweight alternative to external search services such as Typesense or Elasticsearch.

[Official documentation](https://plugins.pinelab.studio/plugin/vendure-plugin-better-search)

## Getting started

1. Install the plugin:

   ```bash
   yarn add @pinelab/vendure-plugin-better-search
   ```

2. Replace `DefaultSearchPlugin` in your Vendure configuration:

   ```ts
   import { BetterSearchPlugin } from '@pinelab/vendure-plugin-better-search';

   // In your VendureConfig:
   plugins: [BetterSearchPlugin.init({})],
   ```

3. Set the index column type for your database **before generating a migration**:

   ```bash
   # MySQL
   BETTER_SEARCH_INDEX_COLUMN_TYPE=longblob

   # PostgreSQL
   BETTER_SEARCH_INDEX_COLUMN_TYPE=bytea
   ```

   The default is `blob`, suitable for SQLite. MySQL's default `blob` has limited capacity.

4. Generate and apply a database migration, then start Vendure. Missing indexes are built automatically per channel and language. Product and variant changes trigger partial updates; a full reindex is scheduled nightly at 4:00 AM by default.

## Storefront search

Use Vendure's standard Shop API `search` query:

```graphql
query {
  search(input: { term: "dumbbells", groupByProduct: true, take: 20 }) {
    totalItems
    items {
      productId
      productName
      slug
      productAsset {
        preview
      }
      priceWithTax {
        ... on SinglePrice {
          value
        }
        ... on PriceRange {
          min
          max
        }
      }
    }
  }
}
```

For autocomplete, use the lightweight `searchSuggestions` query:

```graphql
query {
  searchSuggestions(term: "dumb") {
    suggestion
  }
}
```

## Search configuration

Pass MiniSearch search options to adjust field boosts, prefix matching, and typo tolerance:

```ts
import {
  BetterSearchPlugin,
  MinisearchEngine,
} from '@pinelab/vendure-plugin-better-search';

plugins: [
  BetterSearchPlugin.init({
    searchEngine: new MinisearchEngine({
      boost: { productName: 3, slug: 1.5, description: 1 },
      prefix: true,
      fuzzy: 0.2,
    }),
  }),
],
```

The default engine searches product names, slugs, and descriptions. You can supply your own `SearchEngine` implementation.

Other plugin options include `isEnabled` for channel-specific availability, `debounceIndexRebuildMs` for batching updates, and `reindexSchedule` for the nightly full reindex.

## Search analytics

Open **Settings > Search analytics** in the React Dashboard (requires `ReadCatalog`). Rebuild your Dashboard after adding or updating the plugin.

The read-only table shows terms, search counts, last searched time, latest result count, and latest language. Use built-in search, sorting, filters, and pagination; most searched terms appear first.

For example, filter for terms with low result counts and high search counts to discover what customers are looking for but cannot find.

Analytics cover retained logs in the active channel, combining languages. Result counts and language come from the latest matching search. Date filters select logs before aggregation, so counts reflect the selected period.

- `maxLogsPerChannel`: defaults to **10,000** retained events per channel. `false` or `0` disables recording and clears history at the next nightly cleanup. Cleanup is scheduled at 4:30 AM; the limit can be exceeded between runs.
- `searchLogAggregationCacheTtlSeconds`: defaults to **60 seconds**; `0` disables caching. New searches and cleanup do not invalidate cached results before expiry.

Successful Shop API searches record normalized terms of 3–255 characters, including zero-result searches. Each pagination request counts separately. Admin searches, suggestions, and failed searches are excluded. Logging is best-effort and does not delay search responses. Search terms may contain personal information.

For custom integrations, the Admin API provides `searchLogAggregates(options: SearchLogAggregateListOptions)`, returning `items` and `totalItems` with standard Vendure list options and `ReadCatalog` access.
