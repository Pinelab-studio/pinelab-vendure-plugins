# Multi-Server Session Cache Plugin

### [Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-multiserver-db-sessioncache)

This plugin implements a multi-server proof session cache, using the existing database as cache. Vendure's built-in (default) InMemoryCache can cause conflicts on multi-server environment, and setting up Redis only for session caching might be overkill for most shops.

## Getting started

Add the plugin to your config:

```ts
plugins: [MultiServerDbSessionCachePlugin];
```
