# Vendure Script

## [Official documentation here](https://pinelab-plugins.com/plugin/vendure-scripts)

This 'plugin' contains generic scripts that can be used with `Vendure` projects.

## Getting started

### Assign all Products to Channel

This script assigns `Products` from the source channel to the target channel.

```ts
import { assignAllProductsToChannel } from '@pinelab/vendure-scripts';
const assignedProducts = await assignAllProductsToChannel(
  sourceChannelId,
  targetChannelId,
  injector,
  ctx
);
```
