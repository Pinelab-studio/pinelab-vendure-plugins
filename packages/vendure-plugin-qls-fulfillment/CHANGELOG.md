# 1.2.1 (2026-01-28)

- Use 'varchar' instead of 'text' for QLS order id and Vendure order id in database.

# 1.2.0 (2026-01-28)

- Prevent accidently pushing orders multiple times by checking if the order is already synced to QLS.
- Store combination of QLS order id and Vendure order id to prevent duplicate orders in QLS.
- Emit event for failed product pushes, and log it as a warning instead of an error.
- Store failed products as scheduled task data so they can be viewed in the Admin UI.
- Allow specifying UI tab name where the QLS product ID custom field is shown on ProductVariant page.

# 1.1.3 (2026-01-28)

- Gracefully handle missing variants from incoming webhooks by logging instead of throwing an error.

# 1.1.2 (2026-01-14)

- Run scheduled full sync without job queue, because scheduled tasks already run in the worker only.
- Export scheduled task instead of automatically adding it to the config.

# 1.1.1 (2026-01-07)

- Ignoring non-existing order codes in order status updates, instead of throwing an error.
- Update `syncedToQls` custom field inside same transaction, to prevent `Query runner already released. Cannot run queries anymore` errors.

# 1.1.0 (2026-01-07)

- Fix delivery options to be an array of objects with a tag property
- Emit event for failed order push
- Delay 10s before setting custom field `syncedToQls` to prevent race conditions.

# 1.0.0 (2025-11-07)

- Initial release
