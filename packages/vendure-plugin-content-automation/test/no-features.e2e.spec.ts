import { SimpleGraphQLClient, TestServer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getContentPermissions,
  getContentTaskIds,
  getQueryNames,
  startServer,
} from './helpers/feature-test-helpers';

describe('No features configured', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;

  beforeAll(async () => {
    ({ server, adminClient } = await startServer({}, 3054));
  }, 60000);

  it('Starts without any content automation or health API', async () => {
    const queries = await getQueryNames(adminClient);
    expect(queries).not.toContain('contentAutomationUpdates');
    expect(queries).not.toContain('contentCheckOverview');
  });

  it('Registers no scheduled tasks', async () => {
    expect(await getContentTaskIds(adminClient)).toEqual([]);
  });

  it('Registers no Dashboard permissions', async () => {
    expect(await getContentPermissions(adminClient)).toEqual([]);
  });

  afterAll(async () => {
    await server?.destroy();
  });
});
