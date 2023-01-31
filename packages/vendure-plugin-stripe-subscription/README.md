# Vendure Stripe Subscription plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-stripe-subscription/dev/@vendure/core)

A channel aware plugin that allows you to sell subscription based services or memberships through Vendure. Also support
non-subscription payments. This plugin was made in collaboration with the great people
at [isoutfitters.com](https://isoutfitters.com/).

## How it works

A few things you should know before getting started:

- Subscriptions are defined by `Schedules`. A schedule is a blueprint for a subscription and can be reused on multiple
  subscriptions. An example of a schedule is
  `Billed every first of the month, for 6 months`.
- Schedules have a fixed duration. Currently, they do autorenew after this duration. The duration is used to calculate
  prorations and downpayment deductions. Read more on this under [Advanced features](#advanced-features)
- By connecting a `Schedule` to a ProductVariant, you turn the variant into a subscription. The price of the variant is
  the price a customer pays **per interval**.

![](docs/schedule-weekly.png)  
_Managing schedules in the Admin UI_

![](docs/sub-product.png)  
_Connecting a schedule to a product variant_

![](docs/sequence.png)  
_Subscriptions are created in the background, after a customer has finished the checkout_

### Examples of schedules

A variant with price $30,- and schedule `Duration of 6 months, billed montly` is a subscription where the customer is
billed $30,- per month for 6 months.

A variant with price $300 and a schedule of `Duration of 12 months, billed every 2 months` is a subscription where the
customer is billed $300 every 2 months, for a duration of 12 months.

## Getting started

### Setup Stripe webhook

1. Go to Stripe > developers > webhooks and create a webhook to `https://your-vendure.io/stripe-subscriptions/webhook`
2. Select `setup_intent.succeeded` as event for the webhook.

## Vendure setup

3. Add the plugin to your `vendure-config.ts` plugins and admin UI compilation:

```ts
import { StripeSubscriptionPlugin } from 'vendure-plugin-stripe-subscription';

plugins: [
  StripeSubscriptionPlugin,
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

5. Start the Vendure server and login to the admin UI
6. Go to `Settings > Subscriptions` and create a Schedule.
7. Create a variant and select a schedule in the variant detail screen in the admin UI.
8. Create a payment method with the code `stripe-subscription-payment` and select `stripe-subscription` as handler. **
   Your payment method MUST have 'stripe-subscription' in the code field**
9. Set your API key from Stripe.
10. Get the webhook secret from you Stripe dashboard and save it on the payment method.

## Storefront usage

1. From your storefront, add the created variant to your order
2. Add a shippingaddress and a shippingmethod to the order (mandatory for all orders).
3. Call the graphql mutation `createStripeSubscriptionIntent` to receive the Payment intent token.
4. Use this token to display the Stripe form on your storefront. See
   the [Stripe docs](https://stripe.com/docs/payments/accept-a-payment?platform=web&ui=elements#set-up-stripe.js) on how
   to accomplish that.
5. During the checkout the user is only charged any potential downpayment or proration (
   see [Advanced features](#advanced-features)). The recurring charges will occur on the start of the schedule.
6. Have the customer fill out his payment details.
7. Vendure will create the subscriptions after the intent has successfully been completed by the customer.
8. The order will be settled by Vendure when the subscriptions are created.

It's important to inform your customers what you will be billing them in the
future: https://stripe.com/docs/payments/setup-intents#mandates

# Advanced features

## Paid up front

Schedules can be defined as 'Paid up front'. This means the customer will have to pay the total value of the
subscription during the checkout. Paid-up-front subscriptions can not have downpayments, because it's already one big
downpayment.

Example:
![](docs/schedule-paid-up-front.png)
When we connect the schedule above to a variant with price $540,-, the user will be prompted to pay $540,- during the
checkout. The schedules start date is **first of the month**, so a subscription is created to renew the $540,- in 6
months from the first of the month. E.g. the customer buys this subscription on Januari 15 and pays $540,- during
checkout. The subscription's start date is Februari 1, because that's the first of the next month.

The customer will be billed $540 again automatically on July 1, because that's 6 months (the duration) from the start
date of the subscription.

## Prorations

In the example above, the customer will also be billed for the remaining 15 days from Januari 15 to Februari 1, this is
called proration. customer orders a subscription now, but the subscription starts in 5 days, a prorated amount for the
remaining 5 days will be billed to the customer.

Proration is calculated on a yearly basis. E.g, in the example above: $540 is for a duration of 6 months, that means
$1080 for the full year. The day rate of that subscription will then be 1080 / 365 = $2,96. When the customer buys the
subscription on Januari 15, he will be billed $44,40 proration for the remaining 15 days.

### Customer chosen start dates

A customer can decide to start the subscription on January 17, to pay less proration, because there are now only 13 days
left until the first of Februari. This can be done in the storefront with the following query:

```graphql
mutation {
  addItemToOrder(
    productVariantId: 1
    quantity: 1
    customFields: { startDate: "2023-01-31T09:18:28.533Z" }
  ) {
    ... on Order {
      id
    }
  }
}
```

### Customer chosen downpayments

A customer can also choose to pay a higher downpayment, to lower the recurring costs of a subscription.

Example:
A customer buys a subscription that has a duration of 6 months, and costs $90 per month. The customer can choose to pay
a downpayment of $270,- during checkout to lower to monthly price. The $270 downpayment will be deducted from the
monthly price: 270 / 6 months = $45. With the downpayment of $270, customer will now be billed 90 - 45 = $45,- per month
for the next 6 months.

Downpayments can be added via a custom field on the order line:

```graphql
mutation {
  addItemToOrder(
    productVariantId: 1
    quantity: 1
    customFields: { downpayment: 27000 }
  ) {
    ... on Order {
      id
    }
  }
}
```

Downpayments can never be lower that the amount set in the schedule, and never higher than the total value of a
subscription.

### Preview pricing calculations

You can preview the pricing model of a subscription without adding it to cart with the following query on the shop-api:

```graphql
{
  getStripeSubscriptionPricing(
    input: {
      productVariantId: 1
      # Optional dynamic start date
      startDate: "2022-12-25T00:00:00.000Z"
      # Optional dynamic downpayment
      downpayment: 1200
    }
  ) {
    downpayment
    totalProratedAmount
    proratedDays
    recurringPrice
    interval
    intervalCount
    amountDueNow
    subscriptionStartDate
    schedule {
      id
      name
      downpaymentWithTax
      durationInterval
      durationCount
      startMoment
      paidUpFront
      billingCount
      billingInterval
    }
  }
}
```

`Downpayment` and `startDate` are optional parameters. Without them, the defaults defined by the schedule will be used.

## Caveats

1. This plugin overrides any set OrderItemCalculationStrategies. The strategy in this plugin is used for calculating the
   amount due for a subscription, if the variant is a subscription. For non-subscription variants, the normal default
   orderline calculation is used. Only 1 strategy can be used per Vendure instance, so any other
   OrderItemCalculationStrategies are overwritten by this plugin.

### Contributing and dev server

You can locally test this plugin by checking out the source.

1. Create a .env file with the following contents:

```
STRIPE_APIKEY=sk_test_
STRIPE_PUBLISHABLE_KEY=pk_test_
```

2. Run `yarn start`
3. Go to `http://localhost:3050/checkout` to view the Stripe checkout
