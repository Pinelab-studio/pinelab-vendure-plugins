# Vendure Accept Blue Subscriptions

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-accept-blue)

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
   subscriptionStrategy: new DefaultSubscriptionStrategy()
  }),
```

2. Start the server, create a payment method and select Accept Blue as handler
3. Place an order and use one of the payment methods below:

:warning: Set `ACCEPT_BLUE_TEST_MODE=true` in your `.env` to use Accept Blue in test mode.

## Payment methods

These are the different payment methods you can use to pay for an order. Keep in mind that these examples use sample input data.

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

## CORS

If you run into CORS issues loading the Accept Blue hosted tokenization javascript library, you might need to remove the `cross-origin` key on your `script` tag.
