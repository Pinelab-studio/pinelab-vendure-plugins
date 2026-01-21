# 1.10.0 (2026-01-21)

- Emitting `FailedToSendEventToKlaviyoEvent` event when a Klaviyo event fails to be sent

# 1.9.3 (2025-11-13)

- Documentation update

# 1.9.2 (2025-11-06)

- Updated official documentation URL

# 1.9.1 (2025-06-27)

- Don't throw error for products without a price when generating the product feed
- Filter out disabled variants from the product feed

# 1.9.0 (2025-06-27)

- Added query for retrieving the Klaviyo JSON product feed.
- Added mutation for subscribing to back in stock notifications for a given product.
- Upgrade to Klaviyo Client from 10.1.0 to 18.0.0

# 1.8.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 1.7.0 (2025-05-28)

- Added `RefundEventHandler` to send events to Klaviyo when a refund is created.

# 1.6.2 (2025-05-22)

- Fetch order with relations instead of hydrating in CheckoutStartedEvent, to prevent order object modification

# 1.6.1 (2025-02-19)

- Fetch order with relations instead of hydrating, to prevent `Maximum call stack exceeded` (https://github.com/vendure-ecommerce/vendure/issues/3355)

# 1.6.0 (2025-01-14)

- Added mutation to sign up to Klaviyo Audience list

# 1.5.0 (2024-12-19)

- Update Vendure to 3.1.1

# 1.4.0 (2024-12-13)

- Include `klaviyoCheckoutStarted` mutation to be able to use abandoned cart email flows

# 1.3.1 (2024-12-13)

- Don't log push jobs and log errors for channels without api keys

# 1.3.0 (2024-12-12)

- Allow setting an apiKey per channel

# 1.2.1 (2024-12-04)

- Add support for DiscountCode on Placed Order event

# 1.2.0 (2024-08-14)

- Allow setting multiple Klaviyo handlers for Vendure's OrderPlacedEvent
- Allow order items to be excluded from 'Ordered Product' events

# 1.1.1 (2024-08-04)

- Update compatibility range (#480)

# 1.1.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 1.0.1 (2024-06-19)

- Added extra tests for 'Ordered Product' events

# 1.0.0 (2024-06-18)

- Initial setup of the plugin
