# 2.3.2 (2024-06-08)

- Allow searching by invoice number in Invoices list

# 2.3.1 (2024-06-05)

- Sort invoices by created at

# 2.3.0 (2024-06-05)

- Invoice listing page and bulk download of invoices

# 2.2.0 (2024-06-04)

- When an order is cancelled, generate credit invoice, and no invoice regeneration after that

# 2.1.1 (2024-06-04)

- Prevent the possibility of connecting the wrong invoice file to an order with concurrent invoice generation. See #433

# 2.1.0 (2024-02-14)

- Work on ui improvements as described in #352

# 2.0.2 (2024-02-07)

- Sort by latest invoices first in admin UI
- Don't throw error for orders without customer, because the order can be in an active state

# 2.0.1 (2024-01-23)

- Added script for migrating to V2
- Updated default template to support credit invoices

# 2.0.0 (2024-01-07)

- Allow creating new invoices for orders via the Admin UI. Credit invoices will be generated when a previous invoice exists.
- Credit invoice generation can be disabled, the plugin will then just generate a new invoice.
- BREAKING: DB migration is needed, check the README on how to migrate from V1 to V2.
- BREAKING: When using credit invoices, make sure to update your template so it can handle credit invoices. Checkout the included `defaultTemplate` as reference.
- BREAKING: Downloading multiple invoices has been removed. Invoices are now downloaded on a per order basis via the Admin UI.

# 1.2.0 (2023-10-24)

- Updated vendure to 2.1.1

# 1.1.0 (2023-08-14)

- Allow specifying invoice template storage in DB by specifying DB engine: INVOICES_PLUGIN_DB_ENGINE=mysql ([#243](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/243))
