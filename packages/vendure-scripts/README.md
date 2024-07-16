# Vendure Scripts

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-scripts)

This 'plugin' contains generic scripts that can be used with `Vendure` projects. The following scripts are available:

- `assignAllProductsToChannel`: assigns all `Products`, `ProductVariants`,`Facets` and `FacetValues` from the source channel to the target channel.
- `assignProductsToChannel`: assigns specified `Products` with their related `ProductVariants`,`Facets` and `FacetValues` from the source channel to the target channel.
- `assignCustomersToChannel`: assigns all `Customers` from the source channel to the target channel.
- `assignOrdersToChannel`: assigns all `Orders` from the source channel to the target channel.
- `exportDbToFile` and `insertIntoDb` to copy databases from production to test

## Assign products to a new channel

This script assigns all products from the source channel to the target channel

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

## Copying a production database to a test database

These scripts allow you to copy all data from a source database to a target database.

1. Run the script below
2. Optional: Copy over the Vendure assets to your test environment. For Google Cloud we use a [transfer job](https://console.cloud.google.com/transfer/jobs) to copy assets to the test bucket.
3. Don't forget to disable any syncs to external platforms in your test env. For example, disable sending placed orders to Shipmate to prevent test orders ending up in production third party platforms.

Both `exportDbToFile` and `insertIntoDb` will prompt you to proceed first, before actually doing anything.

```ts
import {
  exportDbToFile,
  DBConfig,
  insertIntoDb,
} from '@pinelab/vendure-scripts';
import fs from 'fs/promises';
import path from 'path';

/**
 * @example
 *
 * yarn ts-node scripts/copy-prod-to-test
 */
(async () => {
  // Get Prod env variables
  const prodEnv = require('dotenv').parse(
    await fs.readFile(path.join(__dirname, '../.env'))
  );
  const prodConfig: DBConfig = {
    databaseName: prodEnv.DB_NAME,
    host: prodEnv.DB_HOST,
    password: prodEnv.DB_PASSWORD,
    username: prodEnv.DB_USER,
  };
  // Export prod DB to file
  const prodSqlFile = await exportDbToFile(prodConfig, '/tmp/prod_db.sql');

  // Get Test env variables
  const testEnv = require('dotenv').parse(
    await fs.readFile(path.join(__dirname, '../.env.test'))
  );
  const testConfig: DBConfig = {
    databaseName: testEnv.DB_NAME,
    host: testEnv.DB_HOST,
    password: testEnv.DB_PASSWORD,
    username: testEnv.DB_USER,
  };
  // Insert prod DB into test DB
  await insertIntoDb(testConfig, prodSqlFile);

  console.log(`Copied prod DB to test DB"`);
})();
```
