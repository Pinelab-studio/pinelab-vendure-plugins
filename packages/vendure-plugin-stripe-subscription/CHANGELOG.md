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
