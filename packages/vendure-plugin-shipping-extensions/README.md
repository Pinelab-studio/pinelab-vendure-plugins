# Shipping Extenions Vendure Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-shipping-extensions)

This plugin does two things in general

- adds a shipping eligibility checker to Vendure that checks the total weight and the shipping country of an
  order, to verify if a shipping method is eligible for a given order.
- introduces a distance based (`ShippingCalculator`)[https://docs.vendure.io/reference/typescript-api/shipping/shipping-calculator/], based on a configurable `OrderAddressToGeolocationConversionStrategy` used to convert the `shippingAddress` of an `Order` to geographic latitudinal and longitudinal values.

The weight of a product can be configured on the customfield `Product.weight`. You can configure the units to be in KG,
grams or whatever unit you like.

A Custom `OrderAddressToGeolocationConversionStrategy` can be configured by as follows:

```ts
import {OrderAddressToGeolocationConversionStrategy} from '@pinelab/vendure-plugin-shipping-extensions'
export class USStreetLineToGeolocationConversionStrategy implements OrderAddressToGeolocationConversionStrategy{
   async getGeoLocationForAddress(orderAddress: OrderAddress): Promise<GeoLocation> {
    const location=//...result of a possible API call or any other lookup method
    return {latitude: location.latitude, longitude: location.longitude}
   }
}
```

Some examples:

- Create a shippingmethod for orders placed in Australia, with a total order weight between 10kg and 40kg
- Create a shippingmethod for all orders except the ones placed in Canada and Norway, with a total order weight below
  1100 grams

## Getting started

1. Add the following to the plugins in `vendure-config.ts`:

```ts
plugins: [
  ...
    ShippingByWeightAndCountryPlugin.init({
      /**
       * Weight unit used in the eligibility checker
       * and product customfield.
       * Only used for displaying purposes
       */
      weightUnit: "kg",
      /**
       * The name of the tab the customfield should be added to
       * This can be an existing tab
       */
      customFieldsTab: "Physical properties",
      orderAddressToGeolocationStrategy: new USStreetLineToGeolocationConversionStrategy()
    })
  ...
]
```

2. Start your server
3. Login to the admin UI and go to `Shipping methods`
4. Create a new shippingmethod
5. Under `Shipping eligibility checker` you should see `Check by weight and country`
6. Under `Shipping calculator` you should see `Distance Based Shipping Calculator`

This checker can be used to have a shippingmethod eligible for an order based on the total weight and shipping country
of an order.
