# Sort by popularity Vendure plugin

Sort products and categories by popularity based on previously placed orders.

This plugin periodically scores products and categories based on the amount of times they occur in previously placed orders. The goal is to be able to order products and categories by their popularity, so we can present the most popular products and categories to our customers first.

## Getting started

1. Install the plugin in your `vendure-config.ts`

```ts
import { PopularityScoresPlugin } from 'vendure-plugin-popularity-scores'

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
4. Go to `http://localhost:3000/popularity-scores/<YOUR CHANNEL TOKEN>/<YOUR ENDPOINT SECRET>` to calculate the popularity scores of products and collections. Ideally you would do this periodically, like once a week or so.

## How it works

This plugin exposes an endpoint that can be periodically called: `/popularity-scores/:yourchanneltoken/:yoursecret`. This will push a job named `calculate-popularity` to the worker. The worker will handle this message and do the following:

1. Get all orders from the past 12 months. The amount of months should be configurable.
2. Calculate the amount of times each Variant has been sold.
3. It then calculates the sum of all variants per Product, so that we have the amount of times a Product has been sold in the past 12 months.
4. It normalizes this value to a score of 0 to 10000, because we don't want to expose our number of sales publicly.
5. The normalized score will the be stored on `Product.customFields.popularityScore`
6. It then calculates the popularity of collections, based on the product scores. The collection scores do not have to be normalized again.
7. The score of a parent collection should include the scores of all its subcollections
8. Collection scores should be stored on `Collection.customFields.popularityScore`
9. Both the Product and Collection popularity scores should be publicly available in the GraphQL Shop API.

## Development

Run `yarn start` to start the server. The following will be available after startup:

- `http://localhost:3050/admin` you can login with superadmin/superadmin
- `http://localhost:3050/admin-api` Admin GraphQL playground
- `http://localhost:3050/shop-api` Shop GraphQL playground

Run `yarn test` to run the testcases defined in `test/e2e.spec.ts`
