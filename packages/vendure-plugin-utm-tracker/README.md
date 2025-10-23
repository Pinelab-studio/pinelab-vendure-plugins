# Vendure UTM Tracker Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-campaign-tracker)

Vendure plugin to connect UTM parameters to orders, to measure true attribution per platform. This plugin doesn't include any UI, it only adds the UTM parameters to the orders. You should use your own data visualization or BI tool to visualize the data.

## Getting started

1. Add the plugin to your `vendure-config.ts`

```ts
import { UTMTrackerPlugin, FirstClickAttribution, LastClickAttribution, LinearAttribution } from '@pinelab/vendure-plugin-utm-tracker';

UTMTrackerPlugin.init({
  attributionModel: new FirstClickAttribution(), // or LastClickAttribution, or LinearAttribution
  maxParametersPerOrder: 5, // The maximum number of UTM parameters that can be added to an order. If a customer adds more than this number, the oldest UTM parameters will be removed.
  maxAttributionAgeInDays: 10, // The maximum age of a UTM parameter to be attributed. If a UTM parameter is older than this number of days, it will not be attributed.
}),
```

2. Run a database migration to add the new entities to your database.

## Storefront usage

To add parameters to an order, you can use the `addUTMParametersToOrder` mutation:

```graphql
mutation addUTMParametersToOrder($input: UTMParameterInput!) {
  addUTMParametersToOrder(input: $input)
}
```

Keep in mind that UTM parameters can only be added to an active order! On most page visits, an active order is not present yet, so you should save the parameters in a cookie or local storage and add them to the order when the order is created.

This is the flow we use in our own shops:

![UTM Parameter Flow]([https://img.plantuml.biz/plantuml/png/RLBDQiCm3BxxANHhSka3j8orT8mDzWTh3piL4Ik9cMCRMsafO-y-EQDTslLYiELFtu-qI8oH-yugDcm9DkjdUCE87J55U42dhN4Dt5k_LshugsQR9AMTIOOJ16m8zePRwBdRLjW5D8sxII4AR9lGqbmfKqEnhDZi27pK0WwH4Zc-BO5RSb1yK2eLmEoTU50GJWgy0nmXvufi8YXU_F1_rLBr2TPNQ26nZo9cBk-PBxT16mdrOIYHlcGJ_384SXeSxIze2vesK_7bv3Au4Am_9mAC4G-PRYmfcy0TNRORvL62SVybYmnJgzypEnio3XHh7xi4w62or1eUcRg9905LDkvxXgvdPEFTqVRJcSJAEqRZqY178-EL351hgPvcdjR-DITTVCb0LyTvZfBuBgzullFWFBVYyS-Ch8iFQY6Nl5u_])

[Edit diagram here ](https://editor.plantuml.com/uml/RLBDQiCm3BxxANHhSka3j8orT8mDzWTh3piL4Ik9cMCRMsafO-y-EQDTslLYiELFtu-qI8oH-yugDcm9DkjdUCE87J55U42dhN4Dt5k_LshugsQR9AMTIOOJ16m8zePRwBdRLjW5D8sxII4AR9lGqbmfKqEnhDZi27pK0WwH4Zc-BO5RSb1yK2eLmEoTU50GJWgy0nmXvufi8YXU_F1_rLBr2TPNQ26nZo9cBk-PBxT16mdrOIYHlcGJ_384SXeSxIze2vesK_7bv3Au4Am_9mAC4G-PRYmfcy0TNRORvL62SVybYmnJgzypEnio3XHh7xi4w62or1eUcRg9905LDkvxXgvdPEFTqVRJcSJAEqRZqY178-EL351hgPvcdjR-DITTVCb0LyTvZfBuBgzullFWFBVYyS-Ch8iFQY6Nl5u_)

## Insights and visualizations

This plugin doesn't include any visualization by default, but you can easily write your own insights with SQL. For example, this query will give you the total attributed revenue per source:

```sql
SELECT utm.utmSource, utm.utmMedium, utm.utmCampaign, utm.utmTerm, utm.utmContent, SUM(uop.attributedRevenue) AS totalAttributedRevenue
FROM utm_order_parameter utm
JOIN `order` o ON utm.orderId = o.id
WHERE o.orderPlacedAt IS NOT NULL
  AND o.state != 'Cancelled'
GROUP BY utm.utmSource;
```

You can use different GROUP BY clauses to get the total attributed revenue per medium, campaign, term, content, etc.
