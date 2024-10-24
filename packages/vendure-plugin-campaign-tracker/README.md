# Vendure Campaign Tracker plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-campaign-tracker)

Vendure plugin track campaign revenue by campaign code, so that you can compare different campaigns from different sources.
To track campaigns, your storefront should send campaign codes to Vendure on a page visit:

- Pass a campaign code in the url, e.g. `my-website.com?ref=summer-sale-ad`. This URL is then included in your ads or email campaigns.
- Or, set a fixed campaign code for a landing page. For example, all visits to page `/sale-landing` will get the campaign code `sale-landing`

## Getting started

Add the plugin to your `vendure-config.ts`

```ts
import { CampaignTrackerPlugin, LastInteractionAttribution } from '@pinelab/vendure-plugin-campaign-tracker';

...
plugins: [
  CampaignTrackerPlugin.init({
    // Pick an attribution model. Choose from `LastInteractionAttribution`, `FirstInteractionAttribution`, `LinearAttribution`
    // Or, implement your own by implementing the AttributionModel interface
    attributionModel: new LastInteractionAttribution()
  }),
... // your other plugins
]
```

1. Run a database migration
2. Start Vendure, and navigate to 'Campaign' (below Promotions)
3. Create a campaign, e.g. `my-first-campaign`.
4. Make sure that every page on your storefront includes the following code:

```ts
const url = new URL(window.location.href);
const params = new URLSearchParams(url.search);
const ref = params.get('ref');

const activeOrder = await yourGraphqlClient.query(
  gql`
    mutation addCampaignToOrder($campaignCode: String!) {
      addCampaignToOrder(campaignCode: $campaignCode) {
        id
        code
        total
      }
    }
  `,
  { campaignCode: ref }
);
```

This will add any visits to your website with `?ref=my-first-campaign` campaign to the order. This mutation will create a new active order if none exists yet.

If `my-first-campaign` doesn't exists as campaign in Vendure, the call is ignored and no active order is returned (or created).
