# Vendure Scripts

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-scripts)

This 'plugin' contains some helper scripts that can be used with `Vendure` projects. Helpers scripts include assigning products, customers and orders from a source to a target channel, and copying MySQL databases between environments.

## Example scripts

You will need to create a file to run in your Vendure project. In that file you can import the helpers to do some heavy lifting for you.

```ts
import { ModuleRef } from '@nestjs/core';
import {
  assignAllProductsToChannel,
  assignCustomersToChannel,
  assignOrdersToChannel,
} from '@pinelab/vendure-scripts';
import { ChannelService, Injector, bootstrap } from '@vendure/core';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';

// Load env before config
require('dotenv').config({ path: process.env.ENV_FILE });

import('../src/vendure-config').then(async ({ config }) => {
  // Bootstrap Vendure
  const app = await bootstrap(config);

  const sourceChannel = await app.get(ChannelService).getDefaultChannel();
  const targetChannel = await app
    .get(ChannelService)
    .getChannelFromToken('your-channel-token');
  const injector = new Injector(app.get(ModuleRef));
  const ctx = await getSuperadminContext(app);

  // Assign all products from Source to Target channel
  await assignAllProductsToChannel(
    sourceChannel.id,
    targetChannel.id,
    injector,
    ctx
  );
  // Assign all Customers from Source to Target channel
  await assignCustomersToChannel(defaultChannelId, newChannelId, injector, ctx);

  // Assign all orders from Source to Target channel
  await assignOrdersToChannel(defaultChannelId, newChannelId, injector, ctx);

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
