# Vendure Promotion Extensions

### [Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-promotion-extensions)

A collection of different promotion actions and conditions for Vendure. See documentation below for more information on each action and condition.

# Getting started

This plugin doesn't install any promotion actions or conditions. All you do is import them from the plugin, and include them in your Vendure config.

This is the full list of actions and conditions that are available:

```ts
import { buyMinMaxOfTheSpecifiedProductsCondition } from '@pinelab/vendure-plugin-promotion-extensions';

// vendure-config.ts

    promotionOptions: {
      promotionConditions: [
        buyMinMaxOfTheSpecifiedProductsCondition
      ],
    },

```

## Buy min/max of specified products - `Buy at least {min} and at most {max} of the specified products`

A condition that allows you to set a min-max range for the quantity of products that can be bought. This is useful when you want to create stacked discounts.
For example:

1. For 5 to 10 products, you get 10% off each product
2. For 11 to 20 products, you get 20% off each product
3. For 21 or more products, you get 30% off each product
