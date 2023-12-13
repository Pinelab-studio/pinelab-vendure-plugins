# Vendure Accept Blue Subscriptions

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-accept-blue)

Create recurring subscriptions with the Accept Blue platform.

# How it works

1. A customer places an order with products that represent subscriptions
2. Customer adds a payment to order with `addPaymentToOrder` and supplies credit card details in that call
3. The plugin charges the customer with the initial amount due and creates a recurring subscription for that customer at the Accept Blue platform
4. If all succeed, the order is transitioned to `PaymentSettled`
