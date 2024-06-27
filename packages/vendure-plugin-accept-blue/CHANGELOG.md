# 1.4.0 (2024-07-21)

- Update Version to 2.2.6

# 1.3.1 (2024-06-06)

- Return subscription id in Graphql type for created Accept Blue subscriptions

# 1.3.0 (2024-05-21)

- Allow refunding a transaction via `refundAcceptBlueTransaction` mutation.

# 1.2.0 (2024-05-02)

- `Order.lines.acceptBlueSubscriptions` now fetches created subscriptions from Accept Blue for placed orders, instead of calling your subscription strategy
- `Order.lines.acceptBlueSubscriptions.transactions` shows the transactions made for the given subscriptions

# 1.1.0 (2024-03-12)

- Refactored order line custom field `subscriptionIds` to `acceptBlueSubscriptionIds` to avoid conflicts with for example the Stripe Plugin

# 1.0.1 (2024-03-08)

- Correctly check given input types

# 1.0.0 (2024-03-07)

- Always save payment methods and create recurring schedules and one time charges with a saved payment method
- Allow payment for order with a saved payment method ID

# 0.1.0 (2024-02-20)

- Implement Charge Transaction with e2e tests
- Implement Tokenized Credit Card Payment with e2e tests

# 0.0.1 (2024-02-02)

- Initial release
