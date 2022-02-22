# Vendure Plugin for generating invoices

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-myparcel/dev/@vendure/core)

A plugin for generating pdf invoices for orders. By default, invoices are stored in the directory `invoices` in the root of your project.
The first invoice has a random number, any following invoices will have `previousInvoiceNr + 1`;

- Generates PDF invoices on OrderPlaced events
- Shows all generated invoices in Admin UI if you have the permission `AllowInvoicesPermission`
- Save an HTML template per channel via the Admin UI
- Download multiple invoices as zip via the Admin UI

For the developers:

- Custom storage strategies to save your PDF files somewhere else
- Custom invoice numbering and custom data to inject into your templates

How it works

// TODO describe default strategies
// TODO example Google strategy

## Getting started

// Plugin installation
// Admin Config
// Template via Admin ui
// What default data is available

## Audit

// TODO logs successfull and failed attempts with IP address

## Custom file storage

// TODO storagestrategy, defaultstrategy + External codesample

## Custom invoice numbering and custom data

// TODO dataStrategy, default numbering + External codesample

## Admin UI screenshots

(Images don't show on NPM, visit Github instead)
// Show download all
// TODO add screenshots

## Contributing

Contributions always welcome! Just create a PR on Github

Reach out to me at [pinelab.studio](https://pinelab.studio) if you need any help.
[![Pinelab.studio logo](https://pinelab.studio/img/pinelab-logo.png)](https://pinelab.studio)
