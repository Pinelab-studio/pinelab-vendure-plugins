# Vendure Script

## [Official documentation here](https://pinelab-plugins.com/plugin/vendure-scripts)

This 'plugin' contains generic scripts that can be used with `Vendure` projects.

## Getting started

```ts
import { assignAllProductsToChannel } from '@pinelab/vendure-scripts';
const assignedProducts = await assignAllProductsToChannel(
  sourceChannelId,
  targetChannelId,
  injector,
  ctx
);
```
