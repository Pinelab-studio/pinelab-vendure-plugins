# 2.1.0 (2025-01-10)

- Allow updating created subscriptions via the Admin API
- Moved refunding to admin-api, and only allow with permission UpdateOrder

# 2.0.2 (2025-01-09)

- Piublicly expose ctx in AcceptBlueTransactionEvent

# 2.0.1 (2025-01-09)

- Add ctx to AcceptBlueTransactionEvent

# 2.0.0 (2024-12-19)

- Update Vendure to 3.1.1

# 1.9.1 (2024-12-04)

- Recurring amounts divided by 100

# 1.9.0 (2024-11-21)

- Round up `nrOfBillingCyclesLeft`, to prevent unwanted never-ending subscriptions. See #532
- Made both custom fields `customer.acceptBlueCustomerId` and `orderLine.acceptBlueSubscriptionIds` nullable and readonly. DB migration needed
- Included custom field type declaration file in published package
- Return Declined when payment handling fails, instead of throwing

# 1.8.1 (2024-11-03)

- Bug fix: Return Settled state for successful refunds

# 1.8.0 (2024-11-01)

- Implemented refunding via admin UI for initial AC transaction

# 1.7.2 (2024-10-29)

- Export `AcceptBlueTransactionEvent` from package

# 1.7.1 (2024-09-18)

- Don't throw error while resolving `PaymentMethodQuote.acceptBlueHostedTokenizationKey` if there is no `AcceptBlue` method (#452)

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
