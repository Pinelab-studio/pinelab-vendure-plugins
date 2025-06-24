# 2.1.1 (2025-06-24)

- Improved error logging when incoming webhooks fail
- Don't try to transition to Delivered when the order is in PaymentAuthorized state

# 2.1.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 2.0.8 (2025-05-22)

- Try/catch around event handling, to prevent node process crash on error

# 2.0.7 (2025-04-24)

- Fix for numeric SKU's

# 2.0.6 (2025-04-24)

- Set correct `main` and `types` paths in package.json, now that we don't export files from outside the root anymore.

# 2.0.5 (2025-04-17)

- Process incoming stock and order webhooks via the job queue, to prevent webhook disabling in GoedGepickt

# 2.0.4 (2025-04-15)

- Process stock updates via the job queue, so that it is retried when GoedGepickt returns a `Too Many Attempts` error
- Don't use GoedGepickt as fulfilment handler anymore, instead directly move to `Shipped` or `Delivered` on incoming status change.
- Update image when the image on GoedGepickt is a placeholder

# 2.0.3 (2025-04-03)

- Check for undefined or null, to prevent stock updates with 0 being ignored

# 2.0.2 (2025-03-20)

- Prevent empty update SQL statement
- Update stock in batches of 500

# 2.0.1 (2025-03-20)

- Setting allocated to 0 on incoming stock updates and full sync

# 2.0.0 (2025-03-20)

- Removed validating of webhook signature. Fetching stock and order status directly from GoedGepickt on incoming webhook instead.
- Moved GG config to Channel Custom Fields, instead of custom UI component.
- Breaking: DB migration needed
- Breaking: You need to save GoedGepickt credentials on a channel now: Settings > Channel > GoedGepickt custom fields

# 1.4.1 (2025-03-18)

- Only sync product image on creation, not on update, after complaints from GoedGepickt about too many updates.

# 1.4.0 (2024-12-19)

- Update Vendure to 3.1.1

# 1.3.2 (2024-11-05)

- `orderPlacedAt` field should not be mandatory to push to Picqer

# 1.3.0 (2024-10-18)

- Allow setting custom order state in GoedGepickt

# 1.2.1 (2024-08-04)

- Update compatibility range (#480)

# 1.2.0 (2024-06-21)

- Updated Vendure to 2.2.6

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
