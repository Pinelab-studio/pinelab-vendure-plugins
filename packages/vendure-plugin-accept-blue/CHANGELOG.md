# 1.7 (2024-09-24)

- Automatically register webhooks with Accept Blue on payment method creation and update
- Emit `AcceptBlueTransactionEvent` on incoming webhooks from Accept Blue

# 1.6.1 (2024-08-04)

- Update compatibility range (#480)

# 1.6.0 (2024-07-10)

- Convert `biannually` to every 6 months instead of once every 2 years

# 1.5.0 (2024-07-08)

- Allow test mode to be set at payment method level.
- Removed the usage of env var ACCEPT_BLUE_TEST_MODE for test mode. Use the setting on payment method.

# 1.4.0 (2024-06-21)

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
