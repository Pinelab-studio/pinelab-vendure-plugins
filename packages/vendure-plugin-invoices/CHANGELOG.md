# 2.0.0 (2024-01-07)

- Allow creating new invoices for orders via the Admin UI. Credit invoices will be generated when a previous invoice exists.
- Credit invoice generation can be disabled, the plugin will then just generate a new invoice.
- BREAKING: Checkout the README for migration and breaking changes.

# 1.2.0 (2023-10-24)

- Updated vendure to 2.1.1

# 1.1.0 (2023-08-14)

- Allow specifying invoice template storage in DB by specifying DB engine: INVOICES_PLUGIN_DB_ENGINE=mysql ([#243](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/243))
