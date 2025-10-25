# Vendure UTM Tracker Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-utm-tracker)

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

This is the flow we use in our own shops:

![Storefront flow](https://img.plantuml.biz/plantuml/png/NPBDQa8n48NtUOhPgOls0PHI1P4M-WVLHQ4WqvlH6ymVcRbAtxwJ5Ans6J8dvpjdCcV18aFmHfnuWitw6TwmO22X0WyOhNTn3okVJiQqMJFTi5uT7JjXoBWdE3dfOP2mxJ1aTFjunxceRCleQMQCsy5uqOax4gHYLPmBCKMvdu3q567yGJmn0DDtaaQGpmGf0buePuOy4unVaivF5pbJj23fJy20fU0tk0W-TUY19HLbl8NFkAGREsJlEXHNtrMfHI7WLAI6T0nz3KossYePV65tK0TrZTRjAc7BdgdiKWdg5M6qi1OUXS982Q7hgJkaGI0CqbncAghndovXe4jHq4LkOPK1_pVHkb0-zFww48PTIU4wss__QArEddV7w_HQ6wl1LtxW_bfJkIwgh8RB1359hqsqovPOLvwocUkXVf4V)

[Edit diagram here ](https://editor.plantuml.com/uml/NPBDQa8n48NtUOhPgOls0PHI1P4M-WVLHQ4WqvlH6ymVcRbAtxwJ5Ans6J8dvpjdCcV18aFmHfnuWitw6TwmO22X0WyOhNTn3okVJiQqMJFTi5uT7JjXoBWdE3dfOP2mxJ1aTFjunxceRCleQMQCsy5uqOax4gHYLPmBCKMvdu3q567yGJmn0DDtaaQGpmGf0buePuOy4unVaivF5pbJj23fJy20fU0tk0W-TUY19HLbl8NFkAGREsJlEXHNtrMfHI7WLAI6T0nz3KossYePV65tK0TrZTRjAc7BdgdiKWdg5M6qi1OUXS982Q7hgJkaGI0CqbncAghndovXe4jHq4LkOPK1_pVHkb0-zFww48PTIU4wss__QArEddV7w_HQ6wl1LtxW_bfJkIwgh8RB1359hqsqovPOLvwocUkXVf4V)

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
