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

          // You can register for the Post NL API to do NL and BE lookups
          new PostNLLookupStrategy({
            apiKey: process.env.POSTNL_APIKEY!,
          }),

          // If you want to use the free Postcode.tech, get an API key at https://postcode.tech/ and uncomment the lines below
          // new PostcodeTechStrategy({
          //   apiKey: process.env.POSTCODE_TECH_APIKEY!,
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
You need an active order to be able to access this query!

```gql
# NL lookups with postal code and house number will always give 1 result
query {
  lookupAddress(
    input: { countryCode: "NL", postalCode: "8911 DM", houseNumber: "3" }
  ) {
    streetLine1
    streetLine2
    postalCode
    city
    province
    country
    countryCode
  }
}

# BE lookups with only a postal code and a house number will give multiple results
query {
  lookupAddress(
    input: { countryCode: "BE", postalCode: "9052", houseNumber: "110" }
  ) {
    streetLine1
    streetLine2
    postalCode
    city
    country
    countryCode
  }
}

# To get a single result, you need to also pass streetname
query {
  lookupAddress(
    input: {
      countryCode: "BE"
      postalCode: "9052"
      houseNumber: "110"
      streetName: "Rijvisschepark"
    }
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
import { AddressLookupStrategy } from '@pinelab/vendure-plugin-address-lookup';

export class GermanPostcodeStrategy implements AddressLookupStrategy {
  readonly countryCode = 'DE';

  constructor(private readonly input: PostcodeTechStrategyInput) {}

  validateInput?(input: AddressLookupInput): true | string {
    // Optionally validate the input given by the client
  }

  async lookup(
    ctx: RequestContext,
    input: AddressLookupInput
  ): Promise<OrderAddress[]> {
    // Fetch the address from your own API, and map the results to OrderAddress
  }
}
```
