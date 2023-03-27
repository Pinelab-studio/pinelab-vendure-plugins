# Vendure Picqer Plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-picqer/dev/@vendure/core)

Vendure plugin to sync orders, stock and catalogue with Picqer.com order pick platform.

- Sync placed orders that are ready to pick to Picqer
- Sync all products to Picqer
- Pull stocklevels from Picqer into Vendure

- Vendure should be considered the source of truth for product presentation: Assets, descriptions and names are synced from Vendure to Picqer
- Picqer should be considered the source of truth for stock levels and otpionally for phisical properties.
