import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { config } from './vendure-config';

/** Creates an isolated CMS server with a disposable database and an unused port. */
export async function createCmsTestEnvironment() {
  const directory = await mkdtemp(join(tmpdir(), 'simple-cms-'));
  const port = await getUnusedPort();
  registerInitializer('sqljs', new SqljsInitializer(directory));
  const testConfig = mergeConfig(config, {
    logger: new DefaultLogger({ level: LogLevel.Error }),
    apiOptions: { port },
    dbConnectionOptions: { autoSave: false },
  });
  testConfig.apiOptions.cors = { origin: true, credentials: true };
  const environment = createTestEnvironment(
    testConfig as Required<VendureConfig>,
  );
  return {
    ...environment,
    port,
    directory,
    /** Stops this server and removes its temporary test state. */
    async destroy() {
      try {
        await environment.server.destroy();
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

/** Allocates an unused loopback port without reusing an existing service. */
export async function getUnusedPort(): Promise<number> {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not allocate a test port');
  }
  await new Promise<void>((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
