# Multi-Server Session Cache Plugin

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

This plugin implements a multi-server proof session cache, using the existing database as cache. Vendure's built-in (default) InMemoryCache can cause conflicts on multi-server environment, and setting up Redis only for session caching might be overkill for most shops.

## Getting started

Add the plugin to your config:

```ts
plugins: [MultiServerDbSessionCachePlugin];
```
