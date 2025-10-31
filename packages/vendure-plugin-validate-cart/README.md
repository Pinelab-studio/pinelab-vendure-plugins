# Vendure Validate Cart Plugin

### [Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-validate-cart)

A very lightweight plugin to have custom cart validation rules before proceeding to checkout. For example to check current stock, or check for limited products. You can implement your own validation rules by implementing the `CartValidatorStrategy` interface.

## Getting started

Add the plugin to your config:

```ts
import {
  ValidateCartPlugin,
  DefaultStockValidationStrategy,
} from '@pinelab/vendure-plugin-validate-cart';

// In your plugins array, in vendure-config.ts
plugins: [
  ValidateCartPlugin.init({
    // This is just the sample strategy that checks if the cart has enough stock for the items in the cart.
    validationStrategy: new DefaultStockValidationStrategy(),
  }),
];
```

This will add a `validateActiveOrder` mutation to the shop API.

## Storefront usage

Depending on your validation strategy, you probably want to call the `validateActiveOrder` mutation in the cart page, and again on the payment page:

```gql
mutation ValidateActiveOrderMutation {
  validateActiveOrder {
    message
    errorCode
    relatedOrderLineIds
  }
}
```

If any validation errors are returned, you can display the error to the user with the corresponding order lines. You could even automatically remove the items from the cart based on the `relatedOrderLineIds`.

This action is a mutation rather than a query, because your custom validation logic might need to modify the order, for example to 'lock' an order after validation until payment is completed.

## Custom validation rules

You can implement your own validation rules by implementing the `CartValidatorStrategy` interface. For example, to check if active promotions are still valid for the items in the cart.

```ts
import {
  ValidateCartStrategy,
  ActiveOrderValidationError,
} from '@pinelab/vendure-plugin-validate-cart';

export class PromotionValidator implements ValidateCartStrategy {
  // Tell the plugin to pre-load the promotions for the order
  loadOrderRelations: RelationPaths<Order> = ['promotions'];

  // Validate the order based on your custom logic
  async validate(ctx: RequestContext, activeOrder: Order, injector: Injector) {
    const errors: ActiveOrderValidationError[] = [];
    for (const promotion of activeOrder.promotions) {
      if (!isPromotionValid(promotion)) {
        errors.push({
          message: `Promotion ${promotion.name} is not valid`,
          errorCode: `INVALID_PROMOTION`,
        });
      }
    }
    return errors;
  }
}
```
