[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

# Pinelab Vendure plugins

### Visit [pinelab-plugins.com](https://pinelab-plugins.com/) for official docs and examples.

Check out the plugins in this repository:

- [Admin UI helpers](packages/vendure-plugin-admin-ui-helpers/README.md)
- [PDF Invoices generation](packages/vendure-plugin-invoices/README.md)
- [Google Cloud Storage for Vendure assets](packages/vendure-plugin-google-storage-assets/README.md)
- [Google Cloud Tasks Vendure JobQueue integration](packages/vendure-plugin-google-cloud-tasks/README.md)
- [Send webhooks on configurable Vendure events ](packages/vendure-plugin-webhook/README.md)
- [Coinbase crypto payments plugin](packages/vendure-plugin-coinbase/README.md)
- [Dutch postal code address completion](packages/vendure-plugin-dutch-postalcode/README.md)
- [E-boekhouden - Dutch accounting software integration](packages/vendure-plugin-e-boekhouden/README.md)
- [GoedGepickt order picking integration](packages/vendure-plugin-goedgepickt/README.md)
- [MyParcel shipping integration](packages/vendure-plugin-myparcel/README.md)
- [Order export plugin](packages/vendure-plugin-order-export/README.md)
- [Shipping eligibility checker by weight and country](packages/vendure-plugin-shipping-by-weight-and-country/README.md)
- [Monitor stocklevels and get notified](packages/vendure-plugin-stock-monitoring/README.md)
- [Stripe subscription](packages/vendure-plugin-stripe-subscription/README.md)
- [Update all variants of a product in bulk](packages/vendure-plugin-variant-bulk-update/README.md)
- [Sendcloud integration](packages/vendure-plugin-sendcloud/README.md)
- [Limit amount of variants per order](packages/vendure-plugin-limit-variant-per-order/README.md)
- [Extendible metrics](packages/vendure-plugin-metrics/README.md)

# Development

Contributions welcome!

## Upgrading Vendure version

Follow these steps to upgrade the vendure version of all plugins at once.

1. Create and checkout a new branch like `feat/vendure-1.7.1`
2. Upgrade all Vendure dependencies by running `yarn upgrade:vendure`
3. Create a PR to merge into `master`
