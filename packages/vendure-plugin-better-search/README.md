# Vendure Better Search Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-better-search)

This plugin offers more intuitive storefront search than Vendure's `DefaultSearchPlugin` before the need of an external platform like TypeSense or ElasticSearch.

Important! The scope of this plugin:

- Aims to provide better search experience for _storefront users_ without adding any infrastructure complexity.
- Aims to provide better customizability for the developers in the way products are indexed and searched.
- Doesn't replace the `DefaultSearchPlugin`, but rather offers an additional endpoint in the shop-api for searching. The admin will still use the `DefaultSearchPlugin` for searching.
- This plugin is meant for shops with up to ~10000 variants.

Features:

- Search by term or multiple terms, no and/or logic or query syntax.
- Fuzzy matching / type tolerance
- Custom field indexation
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

⚠️ Set the env variable `BETTER_SEARCH_INDEX_COLUMN_TYPE` for your specific database! Without this, `text` is used as default, but this will be too small for most projects. **Run a database migration after setting this env variable!**

```bash
# For MySQL
BETTER_SEARCH_INDEX_COLUMN_TYPE=mediumblob

# For PostgreSQL
BETTER_SEARCH_INDEX_COLUMN_TYPE=bytea
```

Checkout this page on more information on the different column types: https://orkhan.gitbook.io/typeorm/docs/entities#column-types-for-mysql-mariadb

## Indexing custom fields

You can index custom fields of your products by defining a custom `mapToSearchDocument` function.

For example, we have a custom field `keywords` on our products, and we want to index it:

```ts
import { BetterSearchPlugin, defaultSearchConfig } from '@pinelab/vendure-plugin-better-search';

      BetterSearchPlugin.init({
        mapToSearchDocument: (product, collections) => {
            // Import the default mapping function to get a default search document
          const defaultDocument = defaultSearchConfig.mapToSearchDocument(
            product,
            collections
          );
          const keywords = product.customFields.keywords;
          return {
            ...defaultDocument,
            keywords,
          };
        },
        // Make sure to add `keywords` to the indexable fields, and give it a weight
        indexableFields: {
          ...defaultSearchConfig.indexableFields,
          facetValueNames: 2,
        },
      }),
```

By default, these fields are indexed with the following weights. Checkout the `defaultSearchConfig.ts` for more details.

```ts
  indexableFields: {
    name: 3,
    slug: 2,
    variantNames: 3,
    collectionNames: 1,
    skus: 2,
  },
```

## Tips

- Add a custom field `keywords` to your products, and make the plugin index it. This is where you'd save keywords, synonyms, etc. This will drastically improve the search experience.
- Don't index descriptions unless you really have to, to save on memory usage. Also, most of the shops will have a better search experience when the description is not indexed, since the descriptions usually also contain a lot of noise.
