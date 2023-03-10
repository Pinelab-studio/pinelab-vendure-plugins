# Vendure Goodies plugin

Vendure plugin to enable free customer selected goodies:

- Administrators can determine which variants are eligible as goodies by applying a facet to the variants
- Administrators can create Promotions that determine what goodies are eligible under what conditions
- Customers can view which goodies apply to them or their order during checkout, and select their prefered goodie, and add it to cart
- The selected goodie is added to the order for free.

## Getting started

// TODO vendure config

### Admin UI

1. Create a facet `goodies` with facet values `level-1`, `level-2` and `level-3`
2. Attach these facet values to variants you'd like to make selectable as goodies.
3. Create a Promotion and select Condition `If customer placed more than { amount } orders`, and fill out the number you'd like, e.g. 'placed more than 5 orders'.
4. Attach the Action `Select variants with facets as free goodie` to the Promotion

### Storefront usage

4. On your storefront, call `eligibleGoodies` to show a list of eligible goodies to your customer
5. Add the desired Goodie to the order with `addItemToOrder`
6. The order should now include the Goodie, with a price of €0,-

## Custom Goodie Eligibility checking

// TODO explain how you can create your own condition to

### !! Remove this section before plublishing the plugin

## What needs to happen:

[] Read the above documentation, it should give you an idea of how this plugin should work
[] Write e2e test to cover all functionality
[] Implement testcases
[] Create a custom Promotion Condition that checks the amount of placed orders for a customer
[] Create a custom Promotion Action that discounts 1 variant with the selected facet. Similar to the built in `Discount products with these facets by {}` action, but we don't need the %, because we discount the entire product.
[] Create the `eligibleGoodies` GraphQL query. It should use the configured Promotion to determine what variants are eligible
[] Make all test succeed
