# Vendure GoedGepickt plugin

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-goedgepickt)

Plugin for integrating Vendure with GoedGepickt.

## Getting started

Vendure's responsibilities vs GoedGepickt's responsibilities:

- Vendure is your catalog. If you want a new product, add it in Vendure
- GoedGepickt manages all things stock related. StockLevel, size and weight are all managed in GoedGepickt.

1. Add this to your plugin in `vendure-config.ts`:

```ts
import { GoedgepicktPlugin } from '@pinelab/vendure-plugin-goedgepickt';

plugins: [
  GoedgepicktPlugin.init({
    vendureHost: 'https://your-vendure-server.io/',
    endpointSecret: 'some-secret', // Used to validate incoming requests to /fullsync
    setWebhook: true // Automatically set webhooks in Goedgepickt or not
  }),
  ...
]
```

2. Run a [database migration](https://www.vendure.io/docs/developer-guide/migrations/) to add the new fields and
   entities to your database.
3. Add this plugin to your Admin UI and compile.

```ts
plugins: [
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [GoedgepicktPlugin.ui],
    }),
  }),
];
```

Read more about Admin UI compilation in the Vendure
[docs](https://www.vendure.io/docs/plugins/extending-the-admin-ui/#compiling-as-a-deployment-step)

4. Start the server and navigate to `Settings > Goedgepickt`. Make sure you have the `SetGoedGepicktConfig` permission.
5. Here you can configure your `apiKey` and `webshopUuid` per channel.
6. Click `test` to check your credentials.

When you save the credentials, the plugin will make sure the configured vendureHost is set as webhook for order and
stock updates. **The plugin will never delete webhooks**, so if you ever change your url, you should manually delete the
old webhook via GoedGepickt.

7. Full sync can be run manually via the Admin ui or via a GET request to
   endpoint`/goedgepickt/fullsync/<webhook-secret>/`. A full sync is processed in the worker and can take a few hours to
   finish

### Pickup points / drop off points

This plugin uses custom fields on an order as pickup location address. You can set a pickup points on an order with this
mutation, the plugin will then send the address to Goedgepickt:

```graphql
mutation {
  setOrderCustomFields(
    input: {
      customFields: {
        pickupLocationNumber: "1234"
        pickupLocationCarrier: "1"
        pickupLocationName: "Local shop"
        pickupLocationStreet: "Shopstreet"
        pickupLocationHouseNumber: "13"
        pickupLocationZipcode: "8888HG"
        pickupLocationCity: "Leeuwarden"
        pickupLocationCountry: "nl"
      }
    }
  ) {
    ... on Order {
      id
      code
    }
    ... on NoActiveOrderError {
      errorCode
      message
    }
  }
}
```
