import { SimpleGraphQLClient, TestServer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getContentPermissions,
  getContentTasks,
  startServer,
  storefrontUrls,
} from './helpers/feature-test-helpers';

describe('Automation and content health', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;

  beforeAll(async () => {
    ({ server, adminClient } = await startServer(
      { automationStrategies: [], contentHealth: storefrontUrls },
      3058,
    ));
  }, 60000);

  it('Schedules the health scan after content automation by default', async () => {
    expect(await getContentTasks(adminClient)).toEqual([
      { id: 'content-automation', schedule: '0 2 * * *' },
      { id: 'content-health-full-scan', schedule: '0 3 * * *' },
    ]);
  });

  it('Does not add custom Dashboard permissions', async () => {
    const permissions = await getContentPermissions(adminClient);
    expect(permissions).toEqual([]);
  });

  afterAll(async () => {
    await server?.destroy();
  });
});
