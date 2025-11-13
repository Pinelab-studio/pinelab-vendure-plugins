# Shipping Extenions Vendure Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-shipping-extensions)

A collection of shipping calculators, checkers and promotion conditions that help you create customizable shipping options:

- Country and Weight: Shipping eligibility checker that checks if an order has the configured weight and is placed in country.
- Facet Value and Country: Shipping eligibility checker that checks if an order has configured facet values and is placed in country.
- Flat Rate Item Based Shipping calculator: Flat rate shipping calculator, that uses the highest tax rate of order lines or surcharges as the shipping tax rate.
- Distance based Shipping calculator, to calculate your shipping price based on the distance from your store
- A promotion condition that checks the order's shipping country. For example to only give free shipping to countries X, Y and Z

## Getting started

1. Add the following to the plugins in `vendure-config.ts`:

```ts
plugins: [
  ...
    ShippingExtensionsPlugin.init({
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
    }),
    AdminUiPlugin.init({
        ...
        app: compileUiExtensions({
          extensions: [
            ...
            ShippingExtensionsPlugin.ui
            ],
          ...
        }),
      })
  ...
]
```

2. Start your server
3. Login to the admin UI and go to `Shipping methods`
4. Create a new shippingmethod
5. Under `Shipping eligibility checker` you should see `Check by weight and country` and `Check by facet and country`
6. Under `Shipping calculator` you should see `Distance Based Shipping Calculator`
7. Under Promotions conditions you should see `Order is in country` condition.

## Shipping by weight and country

Some examples:

- Create a shipping method for orders placed in Australia, with a total order weight between 10kg and 40kg
- Create a shipping method for all orders except the ones placed in Canada and Norway, with a total order weight below
  1100 grams

The weight of a product can be configured on the customfield `Product.weight`. You can configure the units to be in KG,
grams or whatever unit you like.

### Custom weight calculation

By default, the plugin will calculate the weight of an order based on the custom field `weight`:

1. It will use the `productVariant.customFields.weight` of each order line
2. If that's not set, it will look for the `productVariant.product.customFields.weight` of each order line.

If you'd like to change this behaviour, you can specify a custom `weightCalculationFunction`:

```ts
ShippingExtensionsPlugin.init({
          weightCalculationFunction: (order) => {
            // The order is hydrated with `order.lines.productVariant.product`
            let totalOrderWeight = 0;
            order.lines.forEach((line) => {
              // Do your calculation magic here.
              totalOrderWeight += line.myCustomWeightField
            });
            return totalWeight;
          },
      }),
```

## Shipping by facets and country

Similar to the `Shipping by weight and country`, this shipping eligibility checker allows you to create shipping methods for orders that have certain facets **and** are placed in a country, for example:

- Shipping method is eligible for orders placed in BE, NL and all items in cart have facet `Mailbox package`

## Additional eligibility check

You can configure an additional eligibility check that can block the final eligibility check. This is then applied to all eligibility checks.

For example: You have different methods configured based on weights and countries, but you only allow pick up for oversized items. You can then configure the plugin to always return false when the order has an oversized item in cart:

```ts
ShippingExtensionsPlugin.init({
    additionalShippingEligibilityCheck: (ctx, injector, order, shippingMethod) => {
      if(hasOversizedItem(order)) {
        return false;
      }
      return true;
    }
}),
```

## Distance based shipping calculator

A configurable `OrderAddressToGeolocationConversionStrategy` is used to convert the `shippingAddress` of an `Order` to a geographic latitudinal and longitudinal, which in turn is used to calculate the distance. The built-in strategy converts a UK postalcode to a lat/lon.

To support distance based calculation in other countries you'd have to implement your own strategy:

```ts
import {OrderAddressToGeolocationConversionStrategy} from '@pinelab/vendure-plugin-shipping-extensions'
export class USStreetLineToGeolocationConversionStrategy implements OrderAddressToGeolocationConversionStrategy{
   async getGeoLocationForAddress(orderAddress: OrderAddress): Promise<GeoLocation> {
    const location=//...result of a possible API call or any other lookup method
    return {latitude: location.latitude, longitude: location.longitude}
   }
}
```
