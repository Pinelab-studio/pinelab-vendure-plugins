# Vendure Address Lookup

## [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-address-lookup)

This Vendure plugin allows you to lookup addresses based on postalcode, housenumber and/or streetname.

## Getting started

```ts
    import { AddressLookupPlugin } from '@pinelab/vendure-plugin-address-lookup';

// In your vendure-config.ts
    plugins: [
      AddressLookupPlugin.init({
        lookupStrategies: [
          // If you want to use Postcode.tech, get an API key at https://postcode.tech/
          new PostcodeTechStrategy({
            apiKey: process.env.POSTCODE_TECH_APIKEY!,
          }),

          // If you want to use PostNL, make sure to get an API key for v2/benelux
            //   new PostNLLookupStrategy({
            //     apiKey: process.env.POSTNL_APIKEY!,
            //     countryCode: 'NL',
            //   }),
          // You can also use PostNL for Belgium
            // new PostNLLookupStrategy({
            //     apiKey: process.env.POSTNL_APIKEY!,
            //     countryCode: 'BE',
            // }),
        ],
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
```

## Storefront usage

In your storefront, you can use the `lookupAddress` mutation to lookup an address.

```gql
query {
  lookupAddress(
    input: { countryCode: "NL", postalCode: "8911 DM", houseNumber: "3" }
  ) {
    streetLine1
    streetLine2
    postalCode
    city
    country
    countryCode
  }
}
```

## Custom lookup strategies

If you want to implement your own strategy, for example to support more countries, or use different API's, you can do so by implementing the `LookupStrategy` interface:

```ts
import { LookupStrategy } from '@pinelab/vendure-plugin-address-lookup';

export class MyLookupStrategy implements LookupStrategy {


```
