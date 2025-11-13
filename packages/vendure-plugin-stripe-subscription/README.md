# Vendure Stripe Subscription plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-stripe-subscription)

A channel aware plugin that allows you to sell subscription based services or products through Vendure. This plugin was made in collaboration with the great people
at [isoutfitters.com](https://isoutfitters.com/).

- [Vendure Stripe Subscription plugin](#vendure-stripe-subscription-plugin)
  - [Official documentation here](#official-documentation-here)
  - [How it works](#how-it-works)
  - [Installation](#installation)
  - [Storefront usage](#storefront-usage)
    - [Retrieving the publishable key](#retrieving-the-publishable-key)
  - [Custom subscription strategy](#custom-subscription-strategy)
    - [Custom subscription inputs](#custom-subscription-inputs)
    - [Multiple subscriptions per variant](#multiple-subscriptions-per-variant)
  - [Caveats](#caveats)
  - [Additional features](#additional-features)
    - [Canceling subscriptions](#canceling-subscriptions)
    - [Refunding subscriptions](#refunding-subscriptions)
    - [Payment eligibility checker](#payment-eligibility-checker)
    - [Contributing and dev server](#contributing-and-dev-server)

## How it works

1. A customer orders a product that represents a subscription
2. During checkout, the customer is asked to pay the initial amount OR to only supply their credit card credentials when no initial payment is needed.
3. After order placement, the subscriptions will be created. Created subscriptions will be logged as history entries on the order.

The default strategy defines subscriptions in the following manner:

- The product variant price is used as monthly price
- The customer pays the initial amount due during the checkout
- The subscription will start one month after purchase, because the first month has been paid during checkout.

You can easily define your own subscriptions with a [custom subscription strategy](#custom-subscription-strategy).

## Installation

1. Add the plugin to your `vendure-config.ts` plugins and admin UI compilation:

```ts
import { StripeSubscriptionPlugin } from '@pinelab/vendure-plugin-stripe-subscription';

plugins: [
  StripeSubscriptionPlugin.init({
    vendureHost: process.env.VENDURE_HOST!,
  }),
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [StripeSubscriptionPlugin.ui],
    }),
  }),
];
```

2. Start the Vendure server and login to the admin UI
3. Create a payment method and select `Stripe Subscription` as handler
4. Fill in your `API key`. `Publishable key` and `Webhook secret` can be left empty at first.
5. Save the payment method and refresh the Admin UI screen.
6. The `Webhook secret` field should now have a value. This means webhooks have been created in your Stripe account. If not, check the server logs.
7. You can (and should) have only 1 payment method with the Stripe Subscription handler per channel.

## Storefront usage

1. On the product detail page of your subscription product, you can preview the subscription for a given variant with this query:

```graphql
  previewStripeSubscriptions(productVariantId: 1) {
    name
    amountDueNow
    variantId
    priceIncludesTax
    recurring {
      amount
      interval
      intervalCount
      startDate
      endDate
    }
  }
```

2. The same can be done for all variants of a product with the query `previewStripeSubscriptionsForProduct`
3. Add the item to cart with the default `AddItemToOrder` mutation.
4. The subscriptions in the active order can be viewed by fetching subscriptions on an order line:

```graphql
activeOrder {
      id
      code
      lines {
        stripeSubscriptions {
          name
          amountDueNow
          variantId
          priceIncludesTax
          recurring {
            amount
            interval
            intervalCount
            startDate
            endDate
          }
        }
      }
    }
```

5. Add a shipping address and a shipping method to the order (mandatory for all orders).
6. You can create `createStripeSubscriptionIntent` to receive a client secret.
7. :warning: Please make sure you render the correct Stripe elements: A created intent can be a `PaymentIntent` or a `SetupIntent`.
8. Use this token to display the Stripe form elements on your storefront. See
   the [Stripe docs](https://stripe.com/docs/payments/accept-a-payment?platform=web&ui=elements#set-up-stripe.js) for more information.
9. The customer can now enter his credit card credentials.
10. Vendure will create the subscriptions in the background, after the intent has successfully been completed by the customer.
11. The order will be settled by Vendure when the subscriptions are created.

It's important to inform your customers what you will be billing them in the
future: https://stripe.com/docs/payments/setup-intents#mandates

### Retrieving the publishable key

You can optionally supply your publishable key in your payment method handler, so that you can retrieve it using the `eligiblePaymentMethods` query:

```graphql
  eligiblePaymentMethods {
    id
    name
    stripeSubscriptionPublishableKey
  }
```

## Custom subscription strategy

You can define your own subscriptions by implementing the `StripeSubscriptionStrategy`:

```ts
import { SubscriptionStrategy } from '@pinelab/vendure-plugin-stripe-subscription';
import { RequestContext, Injector, ProductVariant, Order } from '@vendure/core';

/**
 * This example creates a subscription that charges the customer the price of the variant, every 4 weeks
 */
export class MySubscriptionStrategy implements SubscriptionStrategy {
  isSubscription(
    ctx: RequestContext,
    variant: ProductVariant,
    injector: Injector
  ): boolean {
    // This example treats all products as subscriptions
    return true;
  }

  defineSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    order: Order,
    orderLineCustomFields: { [key: string]: any },
    quantity: number
  ): Subscription {
    return {
      name: `Subscription ${productVariant.name}`,
      priceIncludesTax: productVariant.listPriceIncludesTax,
      amountDueNow: productVariant.listPrice,
      recurring: {
        amount: productVariant.listPrice,
        interval: 'week',
        intervalCount: 4,
        startDate: new Date(),
      },
    };
  }

  // This is used to preview the subscription in the storefront, without adding them to cart
  previewSubscription(
    ctx: RequestContext,
    injector: Injector,
    // Custom inputs can be passed into the preview method via the storefront
    customInputs: any,
    productVariant: ProductVariant
  ): Subscription {
    return {
      name: `Subscription ${productVariant.name}`,
      priceIncludesTax: productVariant.listPriceIncludesTax,
      amountDueNow: productVariant.listPrice,
      recurring: {
        amount: productVariant.listPrice,
        interval: 'week',
        intervalCount: 4,
        startDate: new Date(),
      },
    };
  }
}
```

You can then pass the strategy into the plugin during initialization in `vendure-config.ts`:

```ts
      StripeSubscriptionPlugin.init({
        vendureHost: process.env.VENDURE_HOST!,
        subscriptionStrategy: new MySubscriptionStrategy(),
      }),
```

### Custom subscription inputs

You can pass custom inputs to your strategy, to change how a subscription is defined, for example by having a selectable start date:

1. Define a custom field on an order line named `subscriptionStartDate`
2. When previewing a subscription for a product, you can pass a `subscriptionStartDate` to your strategy:

```graphql
  previewStripeSubscriptionsForProduct(
    productVariantId: 1
    customInputs: { subscriptionStartDate: "2024-01-01" }
  ) {
    name
    amountDueNow
    variantId
    priceIncludesTax
    recurring {
      amount
      interval
      intervalCount
      startDate
      endDate
    }
  }
```

3. In you custom strategy, you would handle the custom input:

```ts
  previewSubscription(
    ctx: RequestContext,
    injector: Injector,
    customInputs: { subscriptionStartDate: string },
    productVariant: ProductVariant
  ): Subscription {
    return {
      name: `Subscription ${productVariant.name}`,
      priceIncludesTax: productVariant.listPriceIncludesTax,
      amountDueNow: productVariant.listPrice,
      recurring: {
        amount: productVariant.listPrice,
        interval: 'week',
        intervalCount: 4,
        startDate: new Date(customInputs.subscriptionStartDate),
      },
    };
  }
```

4. When adding a product to cart, make sure you also set the `subscriptionStartDate` on the order line, so that you can access it in the `defineSubscription` method of your strategy:

```ts
  defineSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    order: Order,
    orderLineCustomFields: { [key: string]: any },
    quantity: number
  ): Subscription {
    return {
      name: `Subscription ${productVariant.name}`,
      priceIncludesTax: productVariant.listPriceIncludesTax,
      amountDueNow: productVariant.listPrice,
      recurring: {
        amount: productVariant.listPrice,
        interval: 'week',
        intervalCount: 4,
        startDate: new Date(orderLineCustomFields.subscriptionStartDate),
      },
    };
  }
```

### Multiple subscriptions per variant

It's possible to define multiple subscriptions per product. For example when you want to support down payments or yearly contributions.

Example: A customer pays $90 a month, but is also required to pay a yearly fee of $150:

```ts
  defineSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
  ): Subscription {
    return [
      {
        name: `Monthly fee`,
        priceIncludesTax: productVariant.listPriceIncludesTax,
        amountDueNow: 0,
        recurring: {
          amount: 9000,
          interval: 'month',
          intervalCount: 1,
          startDate: new Date(),
        },
      }, {
        name: `yearly fee`,
        priceIncludesTax: productVariant.listPriceIncludesTax,
        amountDueNow: 0,
        recurring: {
          amount: 15000,
          interval: 'year',
          intervalCount: 1,
          startDate: new Date(),
        },
      }
    ];
  }
```

## Caveats

1. This plugin overrides any set `OrderItemCalculationStrategy`. The strategy in this plugin is used for calculating the
   amount due for a subscription, if the variant is a subscription. For non-subscription variants, Vendure's default
   order line calculation is used. Only 1 strategy can be used per Vendure instance, so any other
   OrderItemCalculationStrategies are overwritten by this plugin.

## Additional features

### Canceling subscriptions

You can cancel a subscription by canceling the corresponding order line of an order. The subscription will be canceled before the next billing cycle using Stripe's `cancel_at_period_end` parameter.

### Refunding subscriptions

Only initial payments of subscriptions can be refunded. Any future payments should be refunded via the Stripe dashboard.

### Payment eligibility checker

You can use the payment eligibility checker `has-stripe-subscription-products-checker` if you to use a different payment method for orders without subscriptions. The `has-stripe-subscription-products-checker` makes your payment method not eligible if it does not contain any subscription products.

The checker is added automatically, you can just select it via the Admin UI when creating or updating a payment method.

### Contributing and dev server

You can locally test this plugin by checking out the source.

1. Create a .env file with the following contents:

```shell

STRIPE_APIKEY=sk_test_****
STRIPE_PUBLISHABLE_KEY=pk_test_****
VENDURE_HOST=https://280n-dn27839.ngrok-free.app

```

2. Run `yarn start`
3. Go to `http://localhost:3050/checkout` to view the Stripe checkout
4. Use a [Stripe test card](https://stripe.com/docs/testing) as credit card details.
5. See the order being `PaymentSettled` in the admin.
