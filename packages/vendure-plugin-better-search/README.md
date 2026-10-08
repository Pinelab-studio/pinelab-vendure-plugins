# Vendure Better Search Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-better-search)

This plugin offers more intuitive search than Vendure's `DefaultSearchPlugin` before the need of an external platform like TypeSense or ElasticSearch.

This plug is meant for small to medium sized shops with up to ~10000 variants.

# Goals

1. Performant in memory search, without affecting customer facing API calls.
2. Provide relevant, type-tolerant (fuzzy matching) search results, while still meeting goal 1
3. Extensible with custom fields, custom field weighting.

This plugin is not meant to be a replacement for ElasticSearch or TypeSense, but rather a lightweight alternative for small to medium sized shops. If you want to test if it works for you, give it a try and run the load tests we have included.

// TODO fix everything below this line

Features:

- Search by term or multiple terms, no and/or logic or query syntax.
- Fuzzy matching / type tolerance
- Extendable with custom fields
- Index field weighting
- Filtering by facets (faceted search): Planned feature, not implemented yet.

## Getting started

1. Add the plugin to your `vendure-config.ts`:

```ts
import { BetterSearchPlugin } from '@pinelab/vendure-plugin-better-search';

...
plugins: [
  BetterSearchPlugin,
],
```

2. Run a database migration
3. Start the server
4. Do a search via the new `betterSearch` query. The very first time, this will throw an error, and it will start building the index in the background.

```graphql
query Search {
  betterSearch(input: { term: "dumbbells" }) {
    totalItems
    items {
      productId
      slug
      productName
      productAsset {
        id
        preview
      }
      lowestPrice
      lowestPriceWithTax
      highestPrice
      highestPriceWithTax
      facetValueIds
      collectionIds
      collectionNames
    }
  }
}
```

⚠️ Set the env variable `BETTER_SEARCH_INDEX_COLUMN_TYPE` for your specific database! Without this, `blob` is used as default, but this will be too small for most projects. **Run a database migration after setting this env variable!**

```bash
# For MySQL
BETTER_SEARCH_INDEX_COLUMN_TYPE=longblob

# For PostgreSQL
BETTER_SEARCH_INDEX_COLUMN_TYPE=bytea
```

Checkout this page on more information on the different column types: https://orkhan.gitbook.io/typeorm/docs/entities#column-types-for-mysql-mariadb

## Partial reindexing

Product and variant changes automatically enqueue debounced partial updates for all assigned channels and their available languages, skipping channels where search is disabled. Removals take precedence over updates for the same ID. When a deleted entity's assignments are unavailable, removals target existing indexes in all enabled channels.

Consumers can enqueue their own partial jobs through `IndexService.triggerPartialReindex()`. The worker payload is:

```ts
type PartialIndexJob = {
  type: 'partial';
  ctx: SerializedRequestContext;
  updateProductIds: string[];
  updateVariantIds: string[];
  removeProductIds: string[];
  removeVariantIds: string[];
};
```

For example, register this service as a provider in your consumer plugin (which imports `BetterSearchPlugin`):

```ts
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { CollectionModificationEvent, EventBus, Logger } from '@vendure/core';
import { IndexService } from '@pinelab/vendure-plugin-better-search';

@Injectable()
export class CollectionSearchIndexer implements OnApplicationBootstrap {
  constructor(private eventBus: EventBus, private indexService: IndexService) {}

  /** Reindexes variants entering or leaving a collection. */
  onApplicationBootstrap(): void {
    this.eventBus.ofType(CollectionModificationEvent).subscribe((event) => {
      this.indexService
        .triggerPartialReindex({
          type: 'partial',
          ctx: event.ctx.serialize(),
          updateProductIds: [],
          updateVariantIds: event.productVariantIds.map(String),
          removeProductIds: [],
          removeVariantIds: [],
        })
        .catch((error: Error) => {
          Logger.error(error.message, 'CollectionSearchIndexer', error.stack);
        });
    });
  }
}
```

Variants leaving a collection are **updated**, not removed from search. `CollectionModificationEvent` supplies membership changes; collection name changes may require separately resolving all affected variants.

Each public call targets **only the serialized context's channel and language**, without debounce or automatic channel fan-out. Supply a separate context/job for every channel/language you want to update. The index must already exist; otherwise the job fails. Jobs retry twice. Use one worker process: writes are serialized within that process, not coordinated between multiple workers. Partial updates still serialize and persist the complete index blob.

## Custom fields

// TODO index custom fields? How?

```ts
import { BetterSearchPlugin } from '@pinelab/vendure-plugin-better-search';
```

## Tips for improving search relevance

- Add a custom field `keywords` to your products, and make the plugin index it. This is where you'd save keywords, synonyms, etc. This will drastically improve the search experience.
- Use the `weight` option to boost specific fields. For example, boost the custom field `keywords` if you implement it, making it more important for the search engine.
- Use the `boostResult` option to boost (or de-boost) specific results. For example,a common practice is to slightly decrease the category `accessories` to make main products rank higher.

// TODO reference the correct configs. At the time of writing they are not implemented yet.

# Performance tips:

- If your memory usage is too high, try indexing important fields like name, slug and facets only, without indexing descriptions. This will usually still provide a good search experience, but with less memory usage. Descriptions are the main cause of high memory usage, simply because they are longer and contain more text.
- Monitor your database CPU usage. If this is high, you can increase the `debounceIndexRebuildMs` to reduce the number of rebuilds.

If these tips don't work, your dataset might be too large for the Better Search Plugin.

## Search-as-you-type suggestions

For live search-as-you-type interfaces (e.g. autocomplete), use the `searchSuggestions` query instead of the full `search` query. This endpoint only returns suggestion strings and skips the index cache TTL check, making it much cheaper than a full search.

```graphql
query SearchSuggestions($term: String!) {
  searchSuggestions(term: $term) {
    suggestion
  }
}
```

Only use the `search` query when the user submits the search or when you actually need the full result set.
