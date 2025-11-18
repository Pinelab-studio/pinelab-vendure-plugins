# Vendure plugin to fulfill orders via QLS

Vendure plugin to fulfill orders via QLS. This uses QLS as fulfillment center and does not support shipments only via QLS.

To create a new plugin inside this repo:

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-qls-fulfillment)

## Getting started

// TODO

## Stock management

// Todo Setup webhook

This plugin assumes one (default) stock location is used in Vendure, that means you should either:

1. Remove all but one stock location in Vendure
2. Or, remove all stock from other stock locations in Vendure

Vendure assumes the first created stock location is the default stock location.

## Monitoring

Make sure to monitor failed jobs: A job that failed after its retries were exhausted, means:

1. An order was not pushed to QLS
2. A product was not synced to QLS

Monitor your logs for the string `QLS webhook error`. This means an incoming stock update webhook was not processed correctly.
