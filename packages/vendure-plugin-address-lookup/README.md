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
                new GooglePlacesLookupStrategy({
        supportedCountryCodes: ['DE'], // You can use the Google Places API for any country, but you need to register for an API key at https://developers.google.com/maps/documentation/places/web-service/get-api-key
        apiKey: process.env.GOOGLE_PLACES_APIKEY!,
      })

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

In your storefront, you can use the `lookupAddress` mutation to look up an address.
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

## Google Places Strategy

If you want to use the Google Places API, you can do so by registering the `GooglePlacesLookupStrategy` in your config:

```ts
import { GooglePlacesLookupStrategy } from '@pinelab/vendure-plugin-address-lookup';

plugins: [
  AddressLookupPlugin.init({
    lookupStrategies: [
      new GooglePlacesLookupStrategy({
        supportedCountryCodes: ['DE'],
        apiKey: process.env.GOOGLE_PLACES_APIKEY!,
      }),
    ],
  }),
],

```

The Google places API requires you to input the housenumber and streetname. It will mostly give you a single result, even when multiple results can exists.
If that happens, you can pass the postalcode to get a specific result.

```graphql
# This example will give you 1 result: the Parkstraße 4 in Osnabrück
{
  lookupAddress(
    input: { countryCode: "DE", streetName: "Parkstraße", houseNumber: "4" }
  ) {
    streetLine1
    streetLine2
    city
    province
    postalCode
    country
    countryCode
  }
}
```

```graphql
# This example will give you another single result: the Parkstraße 4 in Löningen
{
  lookupAddress(
    input: {
      countryCode: "DE"
      streetName: "Parkstraße"
      houseNumber: "4"
      postalCode: "49624"
    }
  ) {
    streetLine1
    streetLine2
    city
    province
    postalCode
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
  readonly supportedCountryCodes = ['DE'];

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
