# Vendure Better Search Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-better-search)

This plugin offers more intuitive storefront search than Vendure's `DefaultSearchPlugin` without the need of an external platform.

Important! The scope of this plugin:

- Aims to provide better search experience for _storefront users_ without adding any infrastructure complexity.
- Aims to provide better customizability for the developers in the way products are indexed and searched.
- Doesn't replace the `DefaultSearchPlugin`, but rather offers an additional endpoint in the shop-api for searching. The admin will still use the `DefaultSearchPlugin` for searching.
- This plugin is meant for shops with up to ~5000 variants.

Features:

- Fuzzy matching / type tolerance
- Custom field indexation
- Index field weighting

// TODO getting started
