# Vendure Goodies plugin

Vendure plugin to enable free customer selected goodies:

- Administrators can determine which variants are goodies by applying a facet to the variants
- Customers can view which goodies apply to them or their order during checkout, and select their prefered goodie
- The selected goodie is added to the order for free.

## Getting started

// TODO

## How does it work

The default goodie selection works like this:

- Admins creates a facet `goodies` with facet values`level-1`, `level-2` and `level-3`
- The plugin will determine what goodies are eligible for the current customer and order: `level-1` goodies for >5 orders, `level-2` for >10 orders and `level-3`

!! Remove this section before plublishing the plugin

## What needs to happen:

[] Write e2e test to cover all functionality
[] // TODO implement
