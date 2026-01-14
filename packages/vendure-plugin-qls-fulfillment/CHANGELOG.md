# 1.1.1 (2026-01-07)

- Ignoring non-existing order codes in order status updates, instead of throwing an error.
- Update `syncedToQls` custom field inside same transaction, to prevent `Query runner already released. Cannot run queries anymore` errors.

# 1.1.0 (2026-01-07)

- Fix delivery options to be an array of objects with a tag property
- Emit event for failed order push
- Delay 10s before setting custom field `syncedToQls` to prevent race conditions.

# 1.0.0 (2025-11-07)

- Initial release
