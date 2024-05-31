# Vendure Script

## [Official documentation here](https://pinelab-plugins.com/plugin/vendure-scripts)

This 'plugin' contains generic scripts that can be used with `Vendure` projects. The following scripts are available:

- `assignAllProductsToChannel`: assigns all `Products`, `ProductVariants`,`Facets` and `FacetValues` from the source channel to the target channel.
- `assignProductsToChannel`: assigns specified `Products` with their related `ProductVariants`,`Facets` and `FacetValues` from the source channel to the target channel.
- `assignCustomersToChannel`: assigns all `Customers` from the source channel to the target channel.
- `assignOrdersToChannel`: assigns all `Orders` from the source channel to the target channel.

## Getting started

```ts
import { ModuleRef } from '@nestjs/core';
import { assignAllProductsToChannel } from '@pinelab/vendure-scripts';
import { ChannelService, Injector, bootstrap } from '@vendure/core';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';

require('dotenv').config({ path: process.env.ENV_FILE }); // Load env before config
import('../src/vendure-config').then(async ({ config }) => {
  const app = await bootstrap(config);

  const sourceChannel = await app.get(ChannelService).getDefaultChannel();
  const targetChannel = await app
    .get(ChannelService)
    .getChannelFromToken('colourgraphics');
  const injector = new Injector(app.get(ModuleRef));
  const ctx = await getSuperadminContext(app);

  console.log(
    `Assigning all products from ${sourceChannel.code} to ${targetChannel.code}`
  );

  await assignAllProductsToChannel(
    sourceChannel.id,
    targetChannel.id,
    injector,
    ctx
  );

  await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for any background tasks or jobs
  process.exit(0);
});
```
