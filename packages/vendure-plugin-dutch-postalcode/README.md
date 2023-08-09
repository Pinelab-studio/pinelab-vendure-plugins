# Vendure Plugin Dutch Postalcodes

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-dutch-postalcode)

Find Dutch addresses by postalcode and housenumber using https://postcode.tech's api. You need to register to obtain an API key,
but registering is free of charge.

## Getting started

1. Register at https://postcode.tech/ to get an API key
2. Add the following code to your plugins in `vendure-config.ts`

```js
plugins: [
  DutchPostalCodePlugin.init('your-postcode.tech-apikey'),
  ...
]
```

3. Start your Vendure server
4. You can now lookup address details based on a postalcode and housenumber via the shop-api

```graphql
query {
  dutchAddressLookup(input: { postalCode: "8932BR", houseNumber: "48" }) {
    lat
    lon
    postalCode
    houseNumber
    street
    city
    municipality
    province
  }
}
```

The api has permission `Public` set, which requires you to be authorized as guest or logged in customer. If you have an
activeOrder, you're usually authorized.
