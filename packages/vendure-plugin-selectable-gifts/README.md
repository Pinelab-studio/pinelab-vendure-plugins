# Vendure Selectable Gifts Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-selectable-gifts)

Vendure plugin to enable customer selected gifts.

- Administrators can use a Promotion to select products that are applicable as gift.
- Administrators can use Promotion Conditions to determine if gifts are eligible for an order
- The storefront can fetch eligible gifts for an order,and add a gift to cart
- The selected gift in cart wil be free of charge

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

### Gift tiers

You can create multiple promotions with different gifts to support different gift tiers. For example:

- Promotion 1: Customers with over 2 orders can select gifts A, B and C
- Promotion 2: Customers with over 5 orders can select gifts X, Y and Z

When a customer has over 5 placed orders, the `eligibleGifts` query will return gifts A, B, C, X, Y and Z, because both promotion conditions are met. However, only 1 gift can be added to the order.

ℹ️ Only 1 gift can be added to an order at any given time. Selecting a new gift will remove the other selected gift.
