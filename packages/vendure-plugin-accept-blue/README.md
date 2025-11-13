# Vendure Accept Blue Subscriptions

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-accept-blue)

Create recurring subscriptions with the Accept Blue platform.

# How it works

1. A customer places an order with products that represent subscriptions
2. Customer adds a payment to order with `addPaymentToOrder` and supplies credit card details:
   - A customer is created in Accept Blue
   - A payment method with the card details is added to the customer
   - A charge is created for the customer with the initial amount due
   - A recurring subscription(s) for that customer is created
3. If all succeed, the order is transitioned to `PaymentSettled`

# Getting started

1. Add to your Vendure config:

```ts
  AcceptBluePlugin.init({
   vendureHost: 'https://my-vendure-backend.io'
  }),
```

2. Start the server, create a payment method and select Accept Blue as handler
3. Place an order and use one of the payment methods below:

:warning: Set `Use test mode` in your payment handler in the admin UI to use Accept Blue in test mode.

## Payment methods

These are the different payment methods you can use to pay for an order. Keep in mind that these examples use sample input data.

You can use the query `eligibleAcceptBluePaymentMethods` to check what payment methods and card types are enabled. This is configured in Vendure: your Accept Blue API Key should have all methods enabled for this to work.

### Pay with Saved Payment Method

If a customer already has a payment method saved in Accept Blue, you can use that to pay for an order.

```graphql
mutation {
  addPaymentToOrder(
    input: { method: "accept-blue", metadata: { paymentMethodId: 15087 } }
  ) {
    ... on Order {
      id
      code
    }
  }
}
```

### Pay with Check

```graphql
mutation {
  addPaymentToOrder(
    input: {
      method: "accept-blue"
      metadata: {
        name: "Hayden Zieme"
        routing_number: "011000138"
        account_number: "49000002087"
        account_type: "Checking"
        sec_code: "PPD"
      }
    }
  ) {
    ... on Order {
      id
      code
    }
  }
}
```

### Pay with Nonce/Tokenized card

With the hosted tokenization form, you can obtain a token that represents a credit card, and use that to pay for an order.
More info on hosted tokenization here: https://docs.accept.blue/tokenization/v0.2

```graphql
mutation {
  addPaymentToOrder(
    input: {
      method: "accept-blue"
      metadata: {
        source: "nonce-z5frsiogt4kce2paljeb"
        last4: "1115"
        expiry_year: 2030
        expiry_month: 3
      }
    }
  ) {
    ... on Order {
      id
      code
    }
  }
}
```

### Managing payment methods

You can fetch payment methods on a customer: on active customer when you are logged in, or on any customer via the Admin API.

```graphql
query {
  activeCustomer {
    id
    emailAddress
    savedAcceptBluePaymentMethods {
      __typename
      ... on AcceptBlueCardPaymentMethod {
        id
        created_at
        avs_address
        avs_zip
        name
        expiry_month
        expiry_year
        payment_method_type
        card_type
        last4
      }
      ... on AcceptBlueCheckPaymentMethod {
        id
        name
        last4
        sec_code
        account_type
        routing_number
      }
    }
  }
}
```

To update payment methods, you can use the following mutations. For the Shop API, you need to be logged in as the customer and be owner of the payment method. For the Admin API, you only need to be logged in as an admin and have `UpdateCustomer` permissions.

```graphql
mutation {
  updateAcceptBlueCardPaymentMethod(
    input: {
      id: 14969
      address: "Test street 12"
      zip: "test zip"
      name: "My Name Pinelab"
      expiryMonth: 5
      expiryYear: 2040
    }
  ) {
    id
    avs_address
    avs_zip
    name
    expiry_month
    expiry_year
  }
}
```

Or for a check payment method:

```graphql
mutation {
  updateAcceptBlueCheckPaymentMethod(
    input: {
      id: 15012
      name: "My Name Pinelab"
      account_type: "savings"
      routing_number: "011000138"
      sec_code: "PPD"
    }
  ) {
    id
    name
    routing_number
    account_type
    sec_code
  }
}
```

For creating a a card payment method, you need to use Hosted Tokenization (see `Pay with Nonce/Tokenized card` above). After getting a nonce token, you can use the following mutation to create a card payment method. For the Shop API, you need to be logged in. For the Admin API, you need to pass an Accept Blue customer ID into the mutation.

```graphql
mutation {
  createAcceptBlueCardPaymentMethod(
    input: { nonce: "nonce-z5frsiogt4kce2paljeb" }
  ) {
    id
  }
}
```

To create a check payment method, you can use the `createAcceptBlueCheckPaymentMethod` mutation.

To connect a new payment method to a subscription, you can use the `updateAcceptBlueSubscription` mutation.

```graphql
mutation {
  updateAcceptBlueSubscription(input: { id: 12345, paymentMethodId: 67890 }) {
    id
    paymentMethodId
  }
}
```

For the Shop API, you need to be logged in as the customer and be owner of the payment method and the recurring schedule. For the Admin API, you only need to be logged in as an admin and have `UpdateOrder` permissions.

## Fetching Transactions and Subscriptions for placed orders

After an order is placed, the `order.lines.acceptBlueSubscriptions` is populated with the actual subscription values from the Accept Blue platform, so it will not call your strategy anymore. This is to better reflect the subscription that was actually created at the time of ordering.

This means you can now also get the transactions per subscriptions with the field `order.lines.acceptBlueSubscriptions.transactions`. To refund a transaction, you first need to get the transaction id.

```graphql
# Sample query
{
  orderByCode(code: "NQWHJ7FNYV7M348Z") {
    id
    code
    lines {
      acceptBlueSubscriptions {
        name
        variantId
        amountDueNow
        priceIncludesTax
        recurring {
          amount
          interval
          intervalCount
          startDate
          endDate
        }
        transactions {
          id
          createdAt
          settledAt
          amount
          status
          errorCode
          errorMessage
          checkDetails {
            # This object is populated when the transaction was made with Check
            name
            routingNumber
            last4
          }
          cardDetails {
            # This object is populated when the transaction was made with a Credit Card
            name
            last4
            expiryMonth
            expiryYear
          }
        }
      }
    }
  }
}
```

## Refunding

Only the initial payment is handled as a Vendure payment, any other refunds are done via a dedicated mutation:

1. Fetch transactions for a customer or a subscription as explained above
2. Use the transaction ID to create a refund:

```graphql
mutation {
  refundAcceptBlueTransaction(transactionId: 123, amount: 4567, cvv2: "999") {
    referenceNumber
    version
    status
    errorMessage
    errorCode
    errorDetails
  }
}
```

The arguments `amount` and `cvv2` are optional, see [the Accept Blue Docs for more info](https://docs.accept.blue/api/v2#tag/processing-credit/paths/~1transactions~1refund).

## Updating Subscriptions

You can update created subscriptions in Accept Blue as Admin via de admin-api with `UpdateOrder` permissions:

```graphql
mutation {
  updateAcceptBlueSubscription(
    input: {
      id: 11820
      title: "New Title For Updated Subscription"
      frequency: daily
    }
  ) {
    id
    name
    variantId
    recurring {
      interval
      intervalCount
    }
    # ... additional subscription fields
  }
}
```

This wil emit an `AcceptBlueSubscriptionEvent` of type `updated`.

## Accept Blue Surcharges

You can use the query `acceptBlueSurcharge` to see what surcharges your account has configured.

## CORS

If you run into CORS issues loading the Accept Blue hosted tokenization javascript library, you might need to remove the `cross-origin` key on your `script` tag.

## Incoming events and webhooks

This plugin emits an `AcceptBlueTransactionEvent` whenever it receives a webhook with a transaction update from Accept Blue.

```ts
import { AcceptBlueTransactionEvent } from '@pinelab/vendure-plugin-accept-blue';

// In your project's application bootstrap
this.eventBus.ofType(AcceptBlueTransactionEvent).subscribe((event) => {
  // Do your magic here
  // Please see the JS docs of `AcceptBlueTransactionEvent` for more information on this object.
  // Event.orderLine may be undefined, for example when refund transactions come in. Refunds are currently not connected to an orderLine
});
```

## Google Pay

This plugin also allows you to integration Google Pay. You will need to implement the Google Pay button on your storefront first.

- Checkout the video to get a good understanding of the flow: https://developers.google.com/pay/api/web/overview
- The complete script is available here: https://developers.google.com/pay/api/web/guides/tutorial#full-example
- Integrate the Google Pay button on your storefront: https://docs.accept.blue/digital-wallet/google-pay

After that, you end up with a `token` you receive from Google. Send that data to Vendure like so:

```graphql
mutation {
  addPaymentToOrder(
    input: {
      method: "accept-blue"
      metadata: {
        source: "googlepay"
        amount: 10.8
        token: "{\"signature\":\"MEUCIFZG..."
      }
    }
  ) {
    ... on Order {
      id
      code
      state
    }
  }
}
```

Make sure that your amount equals the amount of the order! The amount is passed in as whole amount, not in cents, because this is how you will receive it from Google.

You can configure the Merchant ID and Gateway Merchant ID on the payment method in Vendure, and fetch them via `eligiblePaymentMethods` or `eligibleAcceptBluePaymentMethods`.
