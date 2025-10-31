# Vendure UTM Tracker Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-utm-tracker)

This plugin aims to fix over attribution when you use multiple different marketing platforms, by connecting UTM parameters directly to orders.

![UTM Tracker Plugin](https://pinelab-plugins.com/plugin-images/utm-tracker.jpeg)

When using multiple marketing platforms, each platform has their own attribution model, and each doesn't know what the other already attributed. This can lead to over attribution, or double-attribution. This means your ROAS or ROI might look better than it actually is.

This plugin connects UTM parameters directly to orders, so that attribution can never exceed the actual value of an order. This might lead to slight under-attribution, but never to over attribution.

## Getting started

1. Add the plugin to your `vendure-config.ts`

```ts
import { UTMTrackerPlugin, FirstClickAttribution, LastClickAttribution, LinearAttribution, UShapedAttribution } from '@pinelab/vendure-plugin-utm-tracker';

UTMTrackerPlugin.init({
  attributionModel: new FirstClickAttribution(), // or LastClickAttribution, or LinearAttribution, or UShapedAttribution
  maxParametersPerOrder: 5, // The maximum number of UTM parameters that can be added to an order. If a customer adds more than this number, the oldest UTM parameters will be removed.
  maxAttributionAgeInDays: 10, // The maximum age of a UTM parameter to be attributed. If a UTM parameter is older than this number of days, it will not be attributed.
}),


// Include the admin UI extensions of this plugin
AdminUiPlugin.init({
  port: 3002,
  route: 'admin',
  app: compileUiExtensions({
    outputPath: path.join(__dirname, '__admin-ui'),
    extensions: [UTMTrackerPlugin.ui],
  }),
}),
```

2. Run a database migration to add the new entities to your database.

This plugin shows UTM parameters on the order detail page, but doesn't include diagrams or charts. You should use your own data visualization or BI tool to visualize the data.

## Storefront usage

To add parameters to an order, you can use the `addUTMParametersToOrder` mutation:

```graphql
mutation addUTMParametersToOrder($inputs: [UTMParameterInput!]!) {
  addUTMParametersToOrder(input: $input)
}
"""
Example input:
 "input": [
    {
      "connectedAt": "2025-01-01T00:00:00.000Z",
      "source": "test-source1"
      "medium": "test-medium1",
      "campaign": "test-campaign1",
      "term": "test-term1",
      "content": "test-content1"
    },
    {
      "connectedAt": "2025-01-02T00:00:00.000Z",
      "source": "test-source2"
      "medium": "test-medium2",
      "campaign": "test-campaign2",
      "term": "test-term2",
      "content": "test-content2"
    }
  ]
"""
```

Keep in mind that UTM parameters can only be added to an active order! On most page visits, an active order is not present yet, so you should save the parameters in a cookie or local storage, along with the connectedAt date, and add them to the order when the order is created. You should not create a new order for each page visit, because this drastically increase the amount of orders in your database (Most visitors will never create an order, so this is a waste of resources).

You should do something like this in your storefront:

```js
import {storeUtmParameters,  clearUtmParameters} from './utm-util.js'; // See script below

async mounted() { // Or, `useEffect` in React
  const utmParameters = storeUtmParameters(window.location.search); // Store params in local storage on page load
  const activeOrder = await getActiveOrder(); // Or your equivalent of fetching the active order
  if (activeOrder && utmParameters) {
    await addUTMParametersToOrder(utmParameters); // The newly added mutation
    clearUtmParameters(); // Clear the parameters from local storage, so they are not added again later
  }
},
```

<details>
<summary>`utm-util.js` file</summary>

```js
/**
 * Local storage key for storing UTM parameters.
 */
const key = 'vendure_utm_parameters';

/**
 * Parses the given path name, and saves the UTM parameters to the local storage.
 * Does nothing if the path name doesn't contain any UTM parameters.
 *
 * Do not pass full url, but use window.location.search instead.
 */
export function storeUtmParameters(queryParams) {
  const urlParams = new URLSearchParams(queryParams);
  const storedParameters = localStorage.getItem(key);
  const utmParameters = storedParameters ? JSON.parse(storedParameters) : [];
  if (!queryParams.includes('utm_')) {
    // Return existing parameters if no new ones are found. Or undefined if no parameters are stored.
    return utmParameters.length > 0 ? utmParameters : undefined;
  }
  utmParameters.push({
    connectedAt: new Date().toISOString(),
    source: urlParams.get('utm_source') || undefined,
    medium: urlParams.get('utm_medium') || undefined,
    campaign: urlParams.get('utm_campaign') || undefined,
    term: urlParams.get('utm_term') || undefined,
    content: urlParams.get('utm_content') || undefined,
  });
  localStorage.setItem(key, JSON.stringify(utmParameters));
  return utmParameters;
}

/**
 * Clears the UTM parameters from the local storage.
 */
export function clearUtmParameters() {
  localStorage.removeItem(key);
}
```

</details>

## Insights and visualizations

This plugin doesn't include any visualization by default, but you can easily write your own insights with SQL. For example, this query will give you the total attributed revenue per source:

```sql
SELECT utm.utmSource, utm.utmMedium, utm.utmCampaign, utm.utmTerm, utm.utmContent, SUM(utm.attributedRevenue) AS totalAttributedRevenue
FROM utm_order_parameter utm
JOIN `order` o ON utm.orderId = o.id
WHERE o.orderPlacedAt IS NOT NULL
  AND o.state != 'Cancelled'
GROUP BY utm.utmSource;
```

You can use different GROUP BY clauses to get the total attributed revenue per medium, campaign, term, content, etc.
