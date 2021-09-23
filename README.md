[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

# Pinelab Vendure plugins

Monorepo with all Vendure plugins created by Pinelab.

## Webhook plugin

[![webhook plugin version](https://img.shields.io/npm/v/vendure-plugin-webhook)](https://www.npmjs.com/package/vendure-plugin-webhook)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-webhook/dev/@vendure/core)  
Vendure plugin for calling a webhook based on configured events.

## Google Storage Assets plugin

[![webhook plugin version](https://img.shields.io/npm/v/vendure-plugin-google-storage-assets)](https://www.npmjs.com/package/vendure-plugin-google-storage-assets)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-google-storage-assets/dev/@vendure/core)  
Vendure plugin for storing assets in Google Cloud Storage buckets.
Includes the bonus configuration to also generate and store thumbnails in Google Cloud Storage.

## Mollie Payment plugin

[![webhook plugin version](https://img.shields.io/npm/v/vendure-plugin-mollie)](https://www.npmjs.com/package/vendure-plugin-mollie)
![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-mollie/dev/@vendure/core)  
Vendure plugin for handling payments via Mollie platform.

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

## Contributing

Just create a PR!

## Development

Each package has the following commands:

1. `yarn build` compiles typescript. Fails if any types mismatch
2. `yarn serve` start a devserver with the plugin
3. `yarn test` run tests for the plugin

[![Pinelab.studio logo](https://pinelab.studio/pinelab_logo.png)](https://pinelab.studio)
