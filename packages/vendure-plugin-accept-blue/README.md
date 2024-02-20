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

### Pay with Credit Card

```graphql
mutation {
  addPaymentToOrder(
    input: {
      method: "accept-blue"
      metadata: {
        card: "4761530001111118"
        expiry_year: 2025
        expiry_month: 1
        cvv2: "737"
        avs_address: "Testing address"
        avs_zip: "12345"
        name: "Hayden Zieme"
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

### Pay with Tokenized card

```graphql
mutation {
  addPaymentToOrder(
    input: {
      method: "accept-blue"
      metadata: {
        source: "nonce-nonce-token"
        expiry_month: 1
        expiry_year: 2025
        last4: 4444
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

## CORS

If you run into CORS issues loading the Accept Blue hosted tokenization javascript library, you might need to remove the `cross-origin` key on your `script` tag.
