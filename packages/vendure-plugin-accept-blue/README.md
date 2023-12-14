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
