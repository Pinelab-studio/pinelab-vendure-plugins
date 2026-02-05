# 2.10.0 (2026-02-05)

- Upgraded to Vendure 3.5.3

# 2.9.4 (2025-11-13)

- Documentation update

# 2.9.3 (2025-11-06)

- Updated official documentation URL

# 2.9.2 (2025-09-19)

- Don't throw errors for subscription with $0 amount.

# 2.9.1 (2025-07-07)

- skip intent processing in handleIntentSucceeded if order is already PaymentSettled

# 2.9.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 2.8.1(2025-04-26)

- moved default `['card']` paymentMethods and `setup_future_usage: 'off_session'` from `StripeSubscriptionService.createIntentByOrder` and move it into the `createStripeSubscriptionIntent` resolver
- **BREAKING CHANGE**: `StripeSubscriptionService.createIntentByOrder`, `StripeSubscriptionService.createIntent`, and `StripeSubscriptionService.createIntentForDraftOrder` now requires a `paymentMethods: string[]` and `setupFutureUsage` argument; update all calls to pass your desired default (e.g. `['card']`)

# 2.8.0 (2025-04-17)

- Don't validate webhook secret, but call Stripe API directly to get valid data.
- Skip job queue for subscription creation, but create synchronously instead, for direct feedback.

# 2.7.0 (2025-03-11)

- Updated Stripe package to v17.7.0

# 2.6.0 (2024-12-19)

- Update Vendure to 3.1.1

# 2.5.3 (2024-09-18)

- Don't throw error while resolving `PaymentMethodQuote.stripeSubscriptionPublishableKey` if the stripe subscription publishable key is absent (#452)

# 2.5.2 (2024-08-04)

- Update compatibility range (#480)

# 2.5.1 (2024-07-23)

- Fix Vendure crash on payment method with "just" enabled: true/false update

# 2.5.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 2.4.4 (2024-02-02)

- Refactored subscription logic into helper, to make it reusable between Accept Blue and Stripe plugin

# 2.4.3 (2024-01-18)

- Remove `active` check for admin API create Payment Intent as `Draft` orders are not the same as `active` orders and there is no adequate way to manipulate the `active` state directly.

# 2.4.2 (2024-01-18)

- Allow admin API to create Payment Intent based on specified orderId, since there is no concept of an `activeOrder` for an admin

# 2.4.1 (2024-12-03)

- Return empty array instead of throwing an error for variants that are not subscriptions

# 2.4.0 (2024-12-02)

- Made `isSubscription()` async and passed an instance of `Injector`, so that consumers can fetch additional relations inside `isSubscription()`;
- `subscriptionHash` custom field was removed: The plugin doesn't need an order line per subscription per se.

# 2.3.1 (2023-12-26)

- Correctly calculate line price sum when multiple subscriptions are returned

# 2.3.0 (2023-12-26)

- Extended the admin-api to include all of the same methods as the shop-api for Stripe subscription

# 2.2.1 (2023-11-06)

- Extended the `HistoryEntryList` enum to make stripe subscription  custom history entry component work

# 2.2.0 (2023-11-08)

- Return subscriptions per order line on orders

# 2.1.0 (2023-11-02)

- Updated vendure to 2.1.1

# 2.0.0 (2023-11-02)

- Major refactor: ([#260](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/260))
- Scheduling has been taken out of this plugin.
- By default product variants are seen as monthly subscriptions
- Custom subscriptions can be defined by implementing the SubscriptionStrategy interface

# 1.4.0 (2023-09-08)

- Expose proxy function to retrieve all subscriptions for current channel ([#255](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/255))

# 1.3.2 (2023-09-06)

- Fixed selecting schedules on a variant ([#253](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/253))

# 1.1.0 (2023-08-11)

- Expose Stripe publishable key via `eligiblePaymemtMethods.stripeSubscriptionPublishableKey` ([#242](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/242))
