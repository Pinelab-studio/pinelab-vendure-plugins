# Shipping by weight and country Vendure Plugin

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-shipping-by-weight-and-country)

This plugin adds a shipping eligibility checker to Vendure that checks the total weight and the shipping country of an
order, to verify if a shipping method is eligible for a given order.

The weight of a product can be configured on the customfield `Product.weight`. You can configure the units to be in KG,
grams or whatever unit you like.

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
      customFieldsTab: "Physical properties"
    })
  ...
]
```

2. Start your server
3. Login to the admin UI and go to `Shipping methods`
4. Create a new shippingmethod
5. Under `Shipping eligibility checker` you should see `Check by weight and country`

This checker can be used to have a shippingmethod eligible for an order based on the total weight and shipping country
of an order.
