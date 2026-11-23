import { SimpleGraphQLClient, TestServer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ContentCheckService } from '../src';
import {
  getContentPermissions,
  getContentTaskIds,
  getQueryNames,
  startServer,
  updateProductAndWaitForEvent,
} from './helpers/feature-test-helpers';

describe('Automation only', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;

  beforeAll(async () => {
    ({ server, adminClient } = await startServer(
      { automationStrategies: [] },
      3052,
    ));
  }, 60000);

  it('Exposes only the content automation API', async () => {
    const queries = await getQueryNames(adminClient);
    expect(queries).toContain('contentAutomationUpdates');
    expect(queries).not.toContain('contentCheckOverview');
  });

  it('Registers only the content automation scheduled task', async () => {
    expect(await getContentTaskIds(adminClient)).toEqual([
      'content-automation',
    ]);
  });

  it('Does not check a product when it is updated', async () => {
    const checkProduct = vi.spyOn(
      server.app.get(ContentCheckService),
      'checkProduct',
    );
    await updateProductAndWaitForEvent(server, adminClient);
    expect(checkProduct).not.toHaveBeenCalled();
  });

  it('Gives SuperAdmins only the content automation Dashboard permission', async () => {
    const permissions = await getContentPermissions(adminClient);
    expect(permissions).toEqual(['ContentAutomation']);
  });

  afterAll(async () => {
    await server?.destroy();
  });
});
