# 1.1.5 (2024-04-30)

- Push jobs to queue with promise.all(), so that the fullsync webhook finishes faster, and all jobs are in queue.

# 1.1.4 (2024-04-30)

- Query by SKU fix for MySQL. `sku = :sku` instead of `productVariant.sku = :sku`

# 1.1.3 (2024-04-30)

- Log rate limit exceeded as info statements and retry.

# 1.1.2 (2024-04-30)

- Fix related to stock not updating when a variant with the same SKU has been deleted before.

# 1.1.1 (2024-01-16)

- Correctly transition to Delivered from Shipped

# 1.1.0 (2023-10-24)

- Updated vendure to 2.1.1
