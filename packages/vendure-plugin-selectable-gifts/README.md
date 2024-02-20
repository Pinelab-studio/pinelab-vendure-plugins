# Vendure Selectable Gifts Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-selectable-gifts)

Vendure plugin to allow your loyal customers to select gifts when they placed more than X orders, or to select a gift when their order value is over $50.

- Administrators can use a Promotion to select products that are applicable as gift.
- Administrators can use Promotion Conditions to determine if gifts are eligible for an order
- The storefront can fetch eligible gifts for an order,and add a gift to cart
- The selected gift in cart will be free of charge
- Includes the Promotion Condition `When customer placed more than {minimum} orders`

## Getting started

Just add the plugin to the plugins in your `vendure-config.ts`:

```ts
import { SelectableGiftsPlugin } from '@pinelab/vendure-plugin-selectable-gifts';

    plugins: [SelectableGiftsPlugin],
```

### Admin UI

1. Create a Promotion and select Condition `If customer placed more than { amount } orders`, and fill out the number you'd like, e.g. 'placed more than 5 orders'.
2. Attach the Action `Allow selected products as free gift` to the Promotion and select which variants should be selectable as gift.

You can use different conditions for the free gifts, but the promotion **needs to have the selectable_gifts action**, in order for the `eligibleGifts` query to work.

### Storefront usage

1. On your storefront, call `eligibleGifts` to show a list of eligible gifts to your customer:

```graphql
{
  eligibleGifts {
    id
    name
    sku
    priceWithTax
  }
}
```

2. Add the desired Gift to the order with the `addSelectedGiftToOrder` mutation:

```graphql
mutation addSelectedGiftToOrder($productVariantId: ID!) {
  addSelectedGiftToOrder(productVariantId: $productVariantId) {
    ... on Order {
      id
      code
      totalWithTax
      lines {
        id
        quantity
        linePriceWithTax
        discountedUnitPriceWithTax
        discountedLinePriceWithTax
        productVariant {
          id
          name
          sku
        }
        customFields {
          isSelectedAsGift
        }
      }
      discounts {
        amount
        amountWithTax
        description
      }
    }
    ... on ErrorResult {
      errorCode
      message
    }
  }
}
```

3. The order should now include the Gift, with a `discountedLinePriceWithTax` of €0,-
4. You can display the selected gift to the customer by finding the order line that has `customField.isSelectedAsGift = true`. The quantity of that order line will always be 1.

```ts
const orderLineWithGift = order.lines.find(
  (l) => l.customFields.isSelectedAsGift,
);
```

### Gift tiers

You can create multiple promotions with different gifts to support different gift tiers. For example:

- _Tier 1 promotion: Customers with over 2 placed orders can select gifts A, B and C_
- _Tier 2 promotion: Customers with over 5 placed orders can select gifts X, Y and Z_

When a customer has over 5 placed orders, the `eligibleGifts` query will return gifts A, B, C, X, Y and Z, because both promotion conditions are met. However, only 1 gift can be added to the order, even though the gifts come from 2 different promotions.

ℹ️ Only 1 gift can be added to an order at any given time. Selecting a new gift will remove the other selected gift.

If you don't want tier 2 to have tier 1 gifts, you can set a maximum in your promotion condition. It would then look like this:

- _Promotion 1: Customers with 2 - 5 placed orders can select gifts A, B and C_
- _Promotion 2: Customers with 5 - 999 placed orders can select gifts X, Y and Z_
