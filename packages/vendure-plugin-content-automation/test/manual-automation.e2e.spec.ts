import { SimpleGraphQLClient, TestServer } from '@vendure/testing';
import gql from 'graphql-tag';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { waitFor } from '../../test/src/test-helpers';
import { ContentAutomationStrategy } from '../src';
import {
  getContentTaskIds,
  getQueryNames,
  startServer,
} from './helpers/feature-test-helpers';

const productA = createStrategy('product-a', 'product');
const productB = createStrategy('product-b', 'product');
const collectionStrategy = createStrategy('collection-x', 'collection');
const untypedStrategy = createStrategy('untyped');

describe('Manual content automation, with nightly automation turned off', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;

  beforeAll(async () => {
    ({ server, adminClient } = await startServer(
      {
        automationStrategies: [
          productA,
          productB,
          collectionStrategy,
          untypedStrategy,
        ],
        nightlyAutomation: false,
      },
      3056,
    ));
    // The default channel has 'en' and 'nl'
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES, {
      input: { availableLanguages: ['en', 'nl'] },
    });
    await adminClient.query(UPDATE_CHANNEL, {
      input: { id: 'T_1', availableLanguageCodes: ['en', 'nl'] },
    });
    await createSecondChannel(adminClient);
  }, 60000);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Does not schedule nightly automation, but keeps the automation API', async () => {
    expect(await getContentTaskIds(adminClient)).toEqual([]);
    expect(await getQueryNames(adminClient)).toContain(
      'contentAutomationUpdates',
    );
  });

  it('Runs every product strategy for only that product, in every language', async () => {
    const { runContentAutomationForProduct } = await adminClient.query(
      RUN_FOR_PRODUCT,
      { productId: 'T_1' },
    );
    expect(runContentAutomationForProduct.jobsCreated).toBe(4);
    await waitForSettledJobs(adminClient, 4);
    expect(generatedInputs(productA)).toEqual(['1:en', '1:nl']);
    expect(generatedInputs(productB)).toEqual(['1:en', '1:nl']);
    expect(collectionStrategy.generateAndSaveContent).not.toHaveBeenCalled();
    expect(untypedStrategy.generateAndSaveContent).not.toHaveBeenCalled();
    const { contentAutomationUpdates } = await adminClient.query(GET_UPDATES);
    expect(contentAutomationUpdates.totalItems).toBe(4);
  });

  it('Regenerates content when the input is unchanged', async () => {
    const { runContentAutomationForProduct } = await adminClient.query(
      RUN_FOR_PRODUCT,
      { productId: 'T_1' },
    );
    expect(runContentAutomationForProduct.jobsCreated).toBe(4);
    // 4 jobs of the previous test, and 4 of this one
    await waitForSettledJobs(adminClient, 8);
    expect(generatedInputs(productA)).toEqual(['1:en', '1:nl']);
    expect(generatedInputs(productB)).toEqual(['1:en', '1:nl']);
  });

  it('Only runs for the active channel', async () => {
    await adminClient.query(RUN_FOR_PRODUCT, { productId: 'T_1' });
    await waitForSettledJobs(adminClient, 12);
    const channels = productA.generateAndSaveContent.mock.calls.map(
      ([ctx]: [{ channel: { code: string } }]) => ctx.channel.code,
    );
    expect(channels).toEqual(['__default_channel__', '__default_channel__']);
  });

  it('Requires the UpdateProduct permission', async () => {
    await createCatalogAdministrator(adminClient, 'reader@test.com', [
      'ReadCatalog',
    ]);
    await adminClient.asUserWithCredentials('reader@test.com', 'test');
    await expect(
      adminClient.query(RUN_FOR_PRODUCT, { productId: 'T_1' }),
    ).rejects.toThrow('You are not currently authorized');
    await expect(adminClient.query(GET_UPDATES)).rejects.toThrow(
      'You are not currently authorized',
    );
    await adminClient.asSuperAdmin();
    const { jobs } = await adminClient.query(GET_JOBS);
    expect(jobs.totalItems).toBe(12);
  });

  it('Allows reading automation updates with UpdateProduct and no custom permissions', async () => {
    await createCatalogAdministrator(adminClient, 'editor@test.com', [
      'UpdateProduct',
    ]);
    await adminClient.asUserWithCredentials('editor@test.com', 'test');
    try {
      const { contentAutomationUpdates } = await adminClient.query(GET_UPDATES);
      expect(contentAutomationUpdates.totalItems).toBeGreaterThanOrEqual(0);
    } finally {
      await adminClient.asSuperAdmin();
    }
  });

  afterAll(async () => {
    await server?.destroy();
  });
});

/**
 * Creates a strategy that returns inputs for ids 1 and 2 in every channel and language, and always succeeds
 */
function createStrategy(name: string, entityType?: string) {
  return {
    name,
    entityType,
    loadInputData: vi.fn(() =>
      Promise.resolve([
        { id: 1, text: 'one' },
        { id: 2, text: 'two' },
      ]),
    ),
    generateAndSaveContent: vi.fn(() =>
      Promise.resolve({ resultMessage: `Generated by ${name}` }),
    ),
  } satisfies ContentAutomationStrategy;
}

/**
 * Returns `inputId:languageCode` of every `generateAndSaveContent` call of a strategy, sorted
 */
function generatedInputs(strategy: ReturnType<typeof createStrategy>) {
  return strategy.generateAndSaveContent.mock.calls
    .map(
      ([ctx, , input]: [{ languageCode: string }, unknown, { id: number }]) =>
        `${input.id}:${ctx.languageCode}`,
    )
    .sort();
}

/**
 * Waits until the given number of content automation jobs exist, and all of them are completed or failed
 */
async function waitForSettledJobs(
  adminClient: SimpleGraphQLClient,
  total: number,
) {
  await waitFor(async () => {
    const { jobs } = await adminClient.query(GET_JOBS);
    const settled = jobs.items.every((job: { state: string }) =>
      ['COMPLETED', 'FAILED'].includes(job.state),
    );
    return jobs.totalItems === total && settled;
  });
}

/**
 * Creates a second channel with only 'en', in which the strategies also return inputs
 */
async function createSecondChannel(adminClient: SimpleGraphQLClient) {
  const { zones } = await adminClient.query(GET_ZONES);
  await adminClient.query(CREATE_CHANNEL, {
    input: {
      code: 'second-channel',
      token: 'second-channel-token',
      defaultLanguageCode: 'en',
      availableLanguageCodes: ['en'],
      defaultCurrencyCode: 'USD',
      pricesIncludeTax: true,
      defaultShippingZoneId: zones.items[0].id,
      defaultTaxZoneId: zones.items[0].id,
    },
  });
}

/**
 * Creates an administrator with only the supplied built-in permissions.
 */
async function createCatalogAdministrator(
  adminClient: SimpleGraphQLClient,
  emailAddress: string,
  permissions: string[],
) {
  const { createRole } = await adminClient.query(CREATE_ROLE, {
    input: {
      code: emailAddress,
      description: 'Catalog administrator',
      permissions,
    },
  });
  await adminClient.query(CREATE_ADMINISTRATOR, {
    input: {
      firstName: 'Catalog',
      lastName: 'Reader',
      emailAddress,
      password: 'test',
      roleIds: [createRole.id],
    },
  });
}

const RUN_FOR_PRODUCT = gql`
  mutation RunContentAutomationForProduct($productId: ID!) {
    runContentAutomationForProduct(productId: $productId) {
      jobsCreated
    }
  }
`;

const GET_UPDATES = gql`
  query GetContentAutomationUpdates {
    contentAutomationUpdates {
      totalItems
    }
  }
`;

const GET_JOBS = gql`
  query GetContentAutomationJobs {
    jobs(options: { filter: { queueName: { eq: "content-automation" } } }) {
      items {
        state
      }
      totalItems
    }
  }
`;

const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation UpdateGlobalLanguages($input: UpdateGlobalSettingsInput!) {
    updateGlobalSettings(input: $input) {
      __typename
    }
  }
`;

const UPDATE_CHANNEL = gql`
  mutation UpdateTestChannel($input: UpdateChannelInput!) {
    updateChannel(input: $input) {
      __typename
    }
  }
`;

const GET_ZONES = gql`
  query GetTestZones {
    zones {
      items {
        id
      }
    }
  }
`;

const CREATE_CHANNEL = gql`
  mutation CreateTestChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
      __typename
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
