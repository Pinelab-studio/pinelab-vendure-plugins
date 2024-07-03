# Sort by popularity Vendure plugin

Sort products and categories by popularity based on previously placed orders.

This plugin periodically scores products and categories based on the amount of times they occur in previously placed orders. The goal is to be able to order products and categories by their popularity, so we can present the most popular products and categories to our customers first.

## Getting started

1. Install the plugin in your `vendure-config.ts`

```ts
import { PopularityScoresPlugin } from '@pinelab/vendure-plugin-popularity-scores'

...
plugins: [
   PopularityScoresPlugin.init({
     endpointSecret: 'test',
   }),
   ...
];
```

2. [Run a database migration](https://docs.vendure.io/guides/developer-guide/migrations/) to create the custom fields needed for this plugin
3. Start your vendure server
4. Go to `http://localhost:3000/popularity-scores/calculate-scores/<YOUR CHANNEL TOKEN>/<YOUR ENDPOINT SECRET>` to calculate the popularity scores of products and collections. You can also use the default channel's token to generate scores for all channels. Ideally you would do this periodically, like once a week or so.

## How it works

This plugin exposes an endpoint that can be periodically called: `/popularity-scores/calculate-scores/:yourchanneltoken/:yoursecret`. This will push a job named `calculate-popularity` to the worker. The worker will handle this message and do the following:

1. Get all orders from the past 12 months.
2. Calculate the amount of times each Variant has been sold.
3. It then calculates the sum of all variants per Product, so that we have the amount of times a Product has been sold in the past 12 months.
4. It normalizes this value to a score of 0 to 10000, because we don't want to expose our number of sales publicly.
5. The normalized score will the be stored on `Product.customFields.popularityScore`
6. It then calculates the popularity of collections, based on the product scores and it's child collections
7. Collection scores are stored on `Collection.customFields.popularityScore`
8. Both the Product and Collection popularity scores are publicly available in the GraphQL Shop API.

### Popularity scores

Popularity scores should only be used to sort products and collections. The actual values are normalized and don't have any absolute meaning.

Scores of products are based on the amount sold of the past 12 months and normalized to a score of 0 to 1000.

For collections, only the leaf collection scores are normalized. Any parent collection scores are just the sum of their sub-collections. This is to keep the popularity relation between parent/child collection in tact. I.e. a parent's score should be much higher, because it inherits all popularity from it's child collections.

You can compare popularity scores of products with those of other products, but it doesn't really make sense to compare collection scores, because each collection will have a different amount of products in them.
