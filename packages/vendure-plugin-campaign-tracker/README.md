# Vendure Campaign Tracker plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-campaign-tracker)

Vendure plugin to track revenue per campaign server side, so that you can compare different campaigns from different sources.
To track campaigns:

- Create a campaign via the Vendure admin UI
- Pass the created campaign code in the url, e.g. `my-website.com?ref=summer-sale-ad`. This URL is then included in your ads or email campaigns.
- Make your storefront send the campaign code to Vendure with the `addCampaign` mutation

![image](https://pinelab-plugins.com/plugin-images/campaigns.jpeg)

## Getting started

Add the plugin to your `vendure-config.ts`

```ts
import { CampaignTrackerPlugin, LastInteractionAttribution } from '@pinelab/vendure-plugin-campaign-tracker';

...
plugins: [
  CampaignTrackerPlugin.init({
    // Pick an attribution model. Choose from `LastInteractionAttribution`, `FirstInteractionAttribution`, `LinearAttribution`
    // Or, implement your own by implementing the AttributionModel interface.
    // See JsDoc of each model for more information
    attributionModel: new LastInteractionAttribution()
  }),
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [
        CampaignTrackerPlugin.ui,
        ... // your other plugin UI extensions
      ],
    }),
  }),
... // your other plugins
]
```

1. Run a database migration.
2. Rebuild the admin UI
3. Start Vendure, and navigate to 'Campaign' (below Promotions)
4. Create a campaign, e.g. `my-first-campaign`.
5. Make sure that every page on your storefront includes the following code:

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
