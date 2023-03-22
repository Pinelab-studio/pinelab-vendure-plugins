# Vendure Selectable Gifts Plugin

Vendure plugin to enable free customer selected gifts:

- Administrators can use a custom Promotion to select variants that are applicable as gift.
- Administrators can use Promotion Conditions that determine when gifts are eligible for an order
- Customers can view which gifts apply to their order during checkout, and select their prefered gift, and add it to cart
- The selected gift is added to the order for free.

## Getting started

// TODO vendure config

### Admin UI

1. Create a Promotion and select Condition `If customer placed more than { amount } orders`, and fill out the number you'd like, e.g. 'placed more than 5 orders'.
2. Attach the Action `Allow selected products as free gift` to the Promotion and select which variants should be selectable as gift.

You can use different conditions for the free gifts, but the promotion **needs to have the free-gifts action**, in order for the `eligibleGifts` query to work.

### Storefront usage

4. On your storefront, call `eligibleGifts` to show a list of eligible gifts to your customer
5. Add the desired Gift to the order with `addItemToOrder` and with the custom field `isSelectedAsGift=true`
6. // TODO example
7. The order should now include the Gift, with a price of €0,-

### !! Remove this section before plublishing the plugin

## What needs to happen:

[] Read the above documentation, it should give you an idea of how this plugin should work
[] Write e2e test to cover all functionality
[] Implement testcases
[] Create a custom Promotion Condition that checks the amount of placed orders for a customer
[] Create a custom Promotion Action that discounts 1 variant with the selected facet. Similar to the built in `Discount products with these facets by {}` action, but we don't need the %, because we discount the entire product.
[] Create the `eligibleGifts` GraphQL query. It should use the configured Promotion to determine what variants are eligible
[] Make all test succeed
