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
  search(
    input: {
      term: "dumbbells"
      groupByProduct: true
      take: 20
      # Optional: replace with your collection and facet value IDs.
      collectionIds: ["1"]
      facetValueFilters: [{ and: "2" }, { or: ["3", "4"] }]
    }
  ) {
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

This filters to collection `1` and facet value `2` AND (`3` OR `4`). Omit `term` to browse by filters only.

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

### Indexing and exposing custom fields

Use `indexAdditionalFields` to add data to the search index, and `exposeAdditionalGraphqlFields` to explicitly expose stored data on the Shop API's `SearchResult`. These are independent: storing a field does not make it searchable or expose it through GraphQL.

This example assumes Product custom fields `reference`, `assetThumbnail`, and `excludeFromSearch` are configured:

```ts
import { BetterSearchPlugin } from '@pinelab/vendure-plugin-better-search';

type CustomFields = {
  reference?: string;
  assetThumbnail?: string;
  excludeFromSearch?: boolean;
};

BetterSearchPlugin.init({
  indexAdditionalFields: (
    _ctx,
    variants,
    defaultDocumentMapping,
    _injector
  ) => ({
    // Only fields listed here are searchable.
    indexedFields: [...defaultDocumentMapping.indexedFields, 'reference'],
    documents: defaultDocumentMapping.documents.flatMap((document, i) => {
      const customFields = variants[i].product.customFields as CustomFields;
      if (customFields.excludeFromSearch) return [];
      return [
        {
          ...document,
          reference: customFields.reference ?? '',
          // Stored for GraphQL, but not searched.
          assetThumbnail: customFields.assetThumbnail ?? null,
        },
      ];
    }),
  }),
  exposeAdditionalGraphqlFields: {
    reference: {
      graphqlType: 'String!',
      value: (_ctx, document) => document.reference,
    },
    assetThumbnail: {
      graphqlType: 'String',
      value: (_ctx, document) => document.assetThumbnail,
    },
  },
});
```

Query the exposed fields directly:

```graphql
query {
  search(input: { term: "your-reference", groupByProduct: true }) {
    items {
      productName
      reference
      assetThumbnail
    }
  }
}
```

- `indexAdditionalFields` replaces `mapSearchDocuments`. It receives the request context, loaded variants, already-mapped default documents, and Vendure's injector. Return a `SearchDocumentMapping` or a Promise of one; no manual call to `defaultMapSearchDocuments` is needed.
- Preserve document `id` and `productId`; other defaults can be overridden, e.g. `description: ''`. Omit documents to exclude variants from search. All returned fields are stored, but only `indexedFields` are searchable.
- GraphQL field names and `graphqlType` declarations are read at startup, even when the index is empty. Any valid GraphQL output type can be referenced, including scalars, enums, objects, lists, and non-null wrappers; referenced types must already exist in the schema. Restart Vendure after changing these definitions.
- `value(ctx, document)` runs synchronously when search results are returned, using the original indexed document and the current request context. Keep it inexpensive: return stored data or a simple transformation, not a Promise or an asynchronous lookup. Plain `String` fields do not receive automatic asset-URL transformations.
- With `groupByProduct: true`, additional fields come from the highest-scoring representative variant, while prices and facets retain their normal aggregation.
- Partial updates receive only affected variants, remove excluded documents, and ignore returned `indexedFields`. Run a full reindex after changing indexed data or searchable fields.
- Custom `SearchEngine` implementations must include the original `SearchDocument` in each returned `BetterSearchDocument`'s `document` property so GraphQL callbacks can access additional fields.

## Search analytics

Open **Settings > Search analytics** in the React Dashboard (requires `ReadCatalog`). Rebuild your Dashboard after adding or updating the plugin.

The read-only table shows terms, search counts, last searched time, latest result count, and latest language. Use built-in search, sorting, filters, and pagination; most searched terms appear first.

For example, filter for terms with low result counts and high search counts to discover what customers are looking for but cannot find.

Analytics cover retained logs in the active channel, combining languages. Result counts and language come from the latest matching search. Date filters select logs before aggregation, so counts reflect the selected period.

- `maxLogsPerChannel`: defaults to **10,000** retained events per channel. `false` or `0` disables recording and clears history at the next nightly cleanup. Cleanup is scheduled at 4:30 AM; the limit can be exceeded between runs.
- `searchLogAggregationCacheTtlSeconds`: defaults to **60 seconds**; `0` disables caching. New searches and cleanup do not invalidate cached results before expiry.

Successful Shop API searches record normalized terms of 3–255 characters, including zero-result searches. Each pagination request counts separately. Admin searches, suggestions, and failed searches are excluded. Logging is best-effort and does not delay search responses. Search terms may contain personal information.

For custom integrations, the Admin API provides `searchLogAggregates(options: SearchLogAggregateListOptions)`, returning `items` and `totalItems` with standard Vendure list options and `ReadCatalog` access.
