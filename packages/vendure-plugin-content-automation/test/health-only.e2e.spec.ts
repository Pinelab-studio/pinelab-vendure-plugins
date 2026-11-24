import { SimpleGraphQLClient, TestServer } from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  getContentPermissions,
  getContentTaskIds,
  getQueryNames,
  startServer,
  storefrontUrls,
} from './helpers/feature-test-helpers';

describe('Content health only', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;

  beforeAll(async () => {
    ({ server, adminClient } = await startServer(
      { contentHealth: storefrontUrls },
      3053,
    ));
  }, 60000);

  it('Exposes only the content health API', async () => {
    const queries = await getQueryNames(adminClient);
    expect(queries).toContain('contentCheckOverview');
    expect(queries).not.toContain('contentAutomationUpdates');
  });

  it('Registers only the content health scheduled task', async () => {
    expect(await getContentTaskIds(adminClient)).toEqual([
      'content-health-full-scan',
    ]);
  });

  it('Does not add custom Dashboard permissions', async () => {
    const permissions = await getContentPermissions(adminClient);
    expect(permissions).toEqual([]);
  });

  it('Allows reading health results with the built-in ReadProduct permission', async () => {
    await createCatalogReader(adminClient);
    await adminClient.asUserWithCredentials('reader@test.com', 'test');
    const { contentCheckOverview } = await adminClient.query(
      GET_CONTENT_CHECK_OVERVIEW,
    );
    expect(contentCheckOverview.totalItems).toBe(0);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server?.destroy();
  });
});

/**
 * Creates an administrator `reader@test.com` whose role only has `ReadProduct`
 */
async function createCatalogReader(adminClient: SimpleGraphQLClient) {
  const { createRole } = await adminClient.query(CREATE_ROLE, {
    input: {
      code: 'catalog-reader',
      description: 'Catalog reader',
      permissions: ['ReadProduct'],
    },
  });
  await adminClient.query(CREATE_ADMINISTRATOR, {
    input: {
      firstName: 'Catalog',
      lastName: 'Reader',
      emailAddress: 'reader@test.com',
      password: 'test',
      roleIds: [createRole.id],
    },
  });
}

const GET_CONTENT_CHECK_OVERVIEW = gql`
  query GetContentCheckOverview {
    contentCheckOverview {
      totalItems
    }
  }
`;

const CREATE_ROLE = gql`
  mutation CreateRole($input: CreateRoleInput!) {
    createRole(input: $input) {
      id
    }
  }
`;

const CREATE_ADMINISTRATOR = gql`
  mutation CreateAdministrator($input: CreateAdministratorInput!) {
    createAdministrator(input: $input) {
      id
    }
  }
`;
