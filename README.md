[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

# Pinelab Vendure plugins

Monorepo with **free Vendure** plugins for everyone! Check out the plugins in this repository:

- [PDF Invoices generation](packages/vendure-plugin-invoices/README.md)
- [Google Cloud Storage for Vendure assets](packages/vendure-plugin-google-storage-assets/README.md)
- [Google Cloud Tasks Vendure JobQueue integration](packages/vendure-plugin-google-cloud-tasks/README.md)
- [Send webhooks on configurable Vendure events ](packages/vendure-plugin-webhook/README.md)
- [Coinbase crypto payments plugin](packages/vendure-plugin-coinbase/README.md)
- [Dutch postal code address completion](packages/vendure-plugin-dutch-postalcode/README.md)
- [E-boekhouden - Dutch accounting software integration](packages/vendure-plugin-e-boekhouden/README.md)
- [GoedGepickt order picking integration](packages/vendure-plugin-goedgepickt/README.md)
- [MyParcel shipping integration](packages/vendure-plugin-myparcel/README.md)

## Webhook plugin

[![webhook plugin version](https://img.shields.io/npm/v/vendure-plugin-webhook)](https://www.npmjs.com/package/vendure-plugin-webhook)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-webhook/dev/@vendure/core)  
Vendure plugin for calling a webhook based on configured events.

## Google Storage Assets plugin

[![webhook plugin version](https://img.shields.io/npm/v/vendure-plugin-google-storage-assets)](https://www.npmjs.com/package/vendure-plugin-google-storage-assets)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-google-storage-assets/dev/@vendure/core)  
Vendure plugin for storing assets in Google Cloud Storage buckets.
Includes the bonus configuration to also generate and store thumbnails in Google Cloud Storage.

## Dutch Postalcode plugin

[![webhook plugin version](https://img.shields.io/npm/v/vendure-plugin-dutch-postalcode)](https://www.npmjs.com/package/vendure-plugin-dutch-postalcode)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-dutch-postalcode/dev/@vendure/core)  
Vendure plugin for looking up Dutch addresses based on given postalCode and houseNumber. Uses postcode.tech API.

## Cloud Tasks Job plugin

[![webhook plugin version](https://img.shields.io/npm/v/vendure-plugin-google-cloud-tasks)](https://www.npmjs.com/package/vendure-plugin-google-cloud-tasks)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-dutch-postalcode/dev/@vendure/core)  
Vendure plugin using Google Cloud Tasks as queue for job processing.

## MyParcel plugin

[![webhook plugin version](https://img.shields.io/npm/v/vendure-plugin-myparcel)](https://www.npmjs.com/package/vendure-plugin-myparcel)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-myparcel/dev/@vendure/core)  
Sends orders to MyParcel on fulfillment.

## GoedGepickt plugin

[![plugin version](https://img.shields.io/npm/v/vendure-plugin-myparcel)](https://www.npmjs.com/package/vendure-plugin-goedgepickt)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-goedgepickt/dev/@vendure/core)  
Plugin for integrating with the Goedgepickt platform.

## Invoices plugin

[![plugin version](https://img.shields.io/npm/v/vendure-plugin-invoices)](https://www.npmjs.com/package/vendure-plugin-invoices)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-invoices/dev/@vendure/core)  
Plugin for generating PDF invoices for placed orders

## Coinbase plugin

[![plugin version](https://img.shields.io/npm/v/vendure-plugin-invoices)](https://www.npmjs.com/package/vendure-plugin-coinbase)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-coinbase/dev/@vendure/core)  
Plugin for paying with cryptocurrency via Coinbase

## e-Boekhouden plugin

[![plugin version](https://img.shields.io/npm/v/vendure-plugin-invoices)](https://www.npmjs.com/package/vendure-plugin-e-boekhouden)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-e-boekhouden/dev/@vendure/core)  
Plugin for registering your taxes from placed orders with the Dutch e-Boekhouden accounting platform.

## Contributing

Just create a PR!

## Development

**Each package** has the following commands:

1. `yarn build` compiles typescript. Fails if any types mismatch
2. `yarn serve` start a devserver with the plugin
3. `yarn test` run tests for the plugin

Note: Some packages need the `packages/test` or `packages/util` built first.

## Enjoying our plugins?

Enjoy the Pinelab Vendure plugins? [Consider becoming a sponsor](https://github.com/sponsors/Pinelab-studio).

Or check out [pinelab.studio](https://pinelab.studio) for more articles about our integrations.
<br/>
<br/>
<br/>
[![Pinelab.studio logo](https://pinelab.studio/assets/img/favicon.png)](https://pinelab.studio)
