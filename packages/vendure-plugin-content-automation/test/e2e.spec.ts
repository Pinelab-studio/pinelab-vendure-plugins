import { ModuleRef } from '@nestjs/core';
import {
  ChannelService,
  DefaultLogger,
  DefaultSchedulerPlugin,
  Injector,
  LogLevel,
  mergeConfig,
  ProductVariantService,
  RequestContext,
  RequestContextService,
  TransactionalConnection,
} from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  TestServer,
  testConfig,
} from '@vendure/testing';
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
import { initialData } from '../../test/src/initial-data';
import { waitFor } from '../../test/src/test-helpers';
import {
  ContentAutomationPlugin,
  ContentAutomationResult,
  ContentAutomationService,
  ContentAutomationStrategy,
  ContentAutomationUpdate,
  contentAutomationTask,
  defaultHash,
  runContentAutomationPopulation,
} from '../src';

interface TestInput {
  id: string;
  text: string;
}

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
const CREATE_CHANNEL = gql`
  mutation CreateTestChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
      __typename
    }
  }
`;
const GET_JOBS = gql`
  query GetContentAutomationJobs {
    jobs(options: { filter: { queueName: { eq: "content-automation" } } }) {
      items {
        state
        attempts
        data
      }
      totalItems
    }
  }
`;
const GET_UPDATES = gql`
  query GetContentAutomationUpdates(
    $options: ContentAutomationUpdateListOptions
  ) {
    contentAutomationUpdates(options: $options) {
      items {
        id
        strategyName
        languageCode
        hash
        resultMessage
        entityUrl
      }
      totalItems
    }
  }
`;
const GET_SCHEDULED_TASKS = gql`
  query GetScheduledTasks {
    scheduledTasks {
      id
    }
  }
`;

// Mutable test state, used by the strategies below
let inputs: TestInput[] = [];
// Returns the inputs of the test strategy for a ctx: the same `inputs` for every ctx by default
const loadAllInputs = () => Promise.resolve(inputs);
let load: (ctx: RequestContext) => Promise<TestInput[]> = loadAllInputs;
let generate: (
  ctx: RequestContext,
  input: TestInput,
) => Promise<ContentAutomationResult | false>;

/**
 * Successfully generates content for every input
 */
const succeed = (_ctx: RequestContext, input: TestInput) =>
  Promise.resolve({
    resultMessage: `Generated for ${input.id}`,
    entityUrl: `/products/${input.id}`,
  });

// Every ctx passed to `loadInputData`, kept across tests (unlike mock calls, which are cleared)
const loadInputContexts: RequestContext[] = [];

const testStrategy = {
  name: 'test-strategy',
  loadInputData: vi.fn((ctx: RequestContext, _injector: Injector) => {
    loadInputContexts.push(ctx);
    return load(ctx);
  }),
  generateAndSaveContent: vi.fn(
    (ctx: RequestContext, _injector: Injector, input: TestInput) =>
      generate(ctx, input),
  ),
} satisfies ContentAutomationStrategy<TestInput>;

const skippingStrategy = {
  name: 'skipping-strategy',
  loadInputData: vi.fn(() => Promise.resolve([{ id: 'skip-1' }])),
  generateHash: vi.fn(() => 'custom-hash'),
  generateAndSaveContent: vi.fn(() => Promise.resolve(false as const)),
} satisfies ContentAutomationStrategy;

/**
 * Returns `channelCode:languageCode` of a ctx, to easily assert which contexts were used
 */
function ctxKey(ctx: RequestContext): string {
  return `${ctx.channel.code}:${ctx.languageCode}`;
}

const ALL_CONTEXTS = [
  '__default_channel__:en',
  '__default_channel__:nl',
  'second-channel:en',
];

describe('ContentAutomationPlugin (e2e)', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let serverStarted = false;
  let service: ContentAutomationService;

  /**
   * Gets all stored ContentAutomationUpdates
   */
  async function getUpdates(): Promise<ContentAutomationUpdate[]> {
    return server.app
      .get(TransactionalConnection)
      .rawConnection.getRepository(ContentAutomationUpdate)
      .find();
  }

  /**
   * Waits until the given number of content automation jobs exist, and all of them are completed or failed.
   */
  async function waitForSettledJobs(total: number) {
    return waitFor(
      async () => {
        const { jobs } = await adminClient.query(GET_JOBS);
        const settled = jobs.items.every((job: { state: string }) =>
          ['COMPLETED', 'FAILED'].includes(job.state),
        );
        return jobs.totalItems === total && settled ? jobs : undefined;
      },
      100,
      30000,
    );
  }

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Info }),
      plugins: [
        ContentAutomationPlugin.init({
          automationStrategies: [testStrategy, skippingStrategy],
        }),
        DefaultSchedulerPlugin.init(),
      ],
    });
    ({ server, adminClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
    service = server.app.get(ContentAutomationService);
    await adminClient.asSuperAdmin();
    // Default channel has 'en' and 'nl', the second channel only 'en'
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES, {
      input: { availableLanguages: ['en', 'nl'] },
    });
    await adminClient.query(UPDATE_CHANNEL, {
      input: { id: 'T_1', availableLanguageCodes: ['en', 'nl'] },
    });
    const { zones } = await adminClient.query(gql`
      query GetTestZones {
        zones {
          items {
            id
            name
          }
        }
      }
    `);
    const defaultZone = zones.items.find(
      (zone: { name: string }) => zone.name === initialData.defaultZone,
    );
    if (!defaultZone)
      throw new Error('Initial data default zone was not created');
    await adminClient.query(CREATE_CHANNEL, {
      input: {
        code: 'second-channel',
        token: 'second-channel-token',
        defaultLanguageCode: 'en',
        availableLanguageCodes: ['en'],
        defaultCurrencyCode: 'USD',
        pricesIncludeTax: true,
        defaultShippingZoneId: defaultZone.id,
        defaultTaxZoneId: defaultZone.id,
      },
    });
  }, 60000);

  beforeEach(() => {
    vi.clearAllMocks();
    generate = succeed;
    load = loadAllInputs;
  });

  it('Should start successfully', () => {
    expect(serverStarted).toBe(true);
  });

  it('Registers the nightly scheduled task', async () => {
    const { scheduledTasks } = await adminClient.query(GET_SCHEDULED_TASKS);
    expect(scheduledTasks.map((t: { id: string }) => t.id)).toContain(
      'content-automation',
    );
  });

  it('Loads inputs once per strategy, channel and language', async () => {
    inputs = [
      { id: '1', text: 'a' },
      { id: '2', text: 'b' },
    ];
    const result = await service.createJobsForChangedInputs();
    // 2 inputs + 1 skipping input, for 3 contexts
    expect(result.jobsCreated).toBe(9);
    expect(
      testStrategy.loadInputData.mock.calls.map(([ctx]) => ctxKey(ctx)).sort(),
    ).toEqual(ALL_CONTEXTS);
    expect(skippingStrategy.loadInputData).toHaveBeenCalledTimes(3);
  });

  it('Passes a ctx that can be used to load variants with prices', async () => {
    // Requires the default tax zone of the channel to be loaded on the ctx
    const variants = await server.app
      .get(ProductVariantService)
      .findAll(loadInputContexts[0]);
    expect(variants.totalItems).toBeGreaterThan(0);
    expect(variants.items[0].priceWithTax).toBeGreaterThan(0);
  });

  it('Uses the custom generateHash of a strategy', async () => {
    const { jobs } = await adminClient.query(GET_JOBS);
    const skippingJobs = jobs.items.filter(
      (job: { data: { strategyName: string } }) =>
        job.data.strategyName === 'skipping-strategy',
    );
    expect(skippingJobs).toHaveLength(3);
    expect(
      skippingJobs.every(
        (job: { data: { hash: string } }) => job.data.hash === 'custom-hash',
      ),
    ).toBe(true);
  });

  it('Calls generateAndSaveContent with the ctx and input of each job', async () => {
    await waitForSettledJobs(9);
    const calls = testStrategy.generateAndSaveContent.mock.calls.map(
      ([ctx, _injector, input]) => `${ctxKey(ctx)}:${input.id}`,
    );
    expect(calls.sort()).toEqual(
      ALL_CONTEXTS.flatMap((key) => [`${key}:1`, `${key}:2`]),
    );
    expect(skippingStrategy.generateAndSaveContent).toHaveBeenCalledTimes(3);
  });

  it('Stores state for results, but not for deliberately skipped inputs', async () => {
    const updates = await getUpdates();
    expect(updates).toHaveLength(6);
    expect(updates.every((u) => u.strategyName === 'test-strategy')).toBe(true);
    expect(updates.map((u) => u.languageCode).sort()).toEqual([
      'en',
      'en',
      'en',
      'en',
      'nl',
      'nl',
    ]);
    const update = updates.find((u) => u.entityUrl === '/products/1');
    expect(update).toMatchObject({
      resultMessage: 'Generated for 1',
      hash: defaultHash({ id: '1', text: 'a' }),
    });
  });

  it('Skips unchanged inputs, but offers deliberately skipped inputs again', async () => {
    const result = await service.createJobsForChangedInputs();
    // Only the skipping strategy, for 3 contexts
    expect(result.jobsCreated).toBe(3);
    expect(skippingStrategy.generateHash).toHaveBeenCalledTimes(3);
    await waitForSettledJobs(12);
    expect(testStrategy.generateAndSaveContent).not.toHaveBeenCalled();
    expect(await getUpdates()).toHaveLength(6);
  });

  it('Creates jobs only for changed inputs', async () => {
    inputs = [
      { id: '1', text: 'changed' },
      { id: '2', text: 'b' },
    ];
    const result = await service.createJobsForChangedInputs();
    // Input 1 + skipping input, for 3 contexts
    expect(result.jobsCreated).toBe(6);
    await waitForSettledJobs(18);
    expect(
      testStrategy.generateAndSaveContent.mock.calls.map(
        ([, , input]) => input,
      ),
    ).toEqual([
      { id: '1', text: 'changed' },
      { id: '1', text: 'changed' },
      { id: '1', text: 'changed' },
    ]);
    expect(await getUpdates()).toHaveLength(6);
  });

  it('Retries failing jobs and stores no state when generation keeps failing', async () => {
    inputs = [...inputs, { id: '3', text: 'c' }];
    generate = (ctx, input) =>
      input.id === '3'
        ? Promise.reject(new Error('Transient failure'))
        : succeed(ctx, input);
    const result = await service.createJobsForChangedInputs();
    expect(result.jobsCreated).toBe(6);
    const jobs = await waitForSettledJobs(24);
    const failedJobs = jobs.items.filter(
      (job: { state: string }) => job.state === 'FAILED',
    );
    expect(failedJobs).toHaveLength(3);
    // 1 attempt + 3 retries
    expect(
      failedJobs.every((job: { attempts: number }) => job.attempts === 4),
    ).toBe(true);
    expect(testStrategy.generateAndSaveContent).toHaveBeenCalledTimes(12);
    expect(await getUpdates()).toHaveLength(6);
  }, 60000);

  it('Stores state when a failed job succeeds on retry', async () => {
    const failedOnce = new Set<string>();
    generate = (ctx, input) => {
      const key = `${ctxKey(ctx)}:${input.id}`;
      if (!failedOnce.has(key)) {
        failedOnce.add(key);
        return Promise.reject(new Error('Transient failure'));
      }
      return succeed(ctx, input);
    };
    const result = await service.createJobsForChangedInputs();
    // Input 3 is still unprocessed, + skipping input, for 3 contexts
    expect(result.jobsCreated).toBe(6);
    await waitForSettledJobs(30);
    const updates = await getUpdates();
    expect(updates).toHaveLength(9);
    expect(updates.filter((u) => u.entityUrl === '/products/3')).toHaveLength(
      3,
    );
  }, 60000);

  it('Skips a duplicate job when its hash was already stored', async () => {
    const ctx = new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel: await server.app.get(ChannelService).getDefaultChannel(),
      languageCode: 'en' as RequestContext['languageCode'],
    });
    await service.handleJob({
      ctx: ctx.serialize(),
      strategyName: 'test-strategy',
      input: { id: '2', text: 'b' },
      hash: defaultHash({ id: '2', text: 'b' }),
    });
    expect(testStrategy.generateAndSaveContent).not.toHaveBeenCalled();
    expect(await getUpdates()).toHaveLength(9);
  });

  it('Processes the initial population sequentially, without creating jobs', async () => {
    await server.app
      .get(TransactionalConnection)
      .rawConnection.getRepository(ContentAutomationUpdate)
      .clear();
    let running = 0;
    let maxRunning = 0;
    generate = async (ctx, input) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      running--;
      if (input.id === '3') {
        throw new Error('Failure during population');
      }
      return succeed(ctx, input);
    };
    const result = await service.runInitialPopulation();
    // 3 inputs + 1 skipping input, for 3 contexts. Input 3 fails in every context
    expect(result).toEqual({ processed: 9, failed: 3 });
    expect(maxRunning).toBe(1);
    const { jobs } = await adminClient.query(GET_JOBS);
    expect(jobs.totalItems).toBe(30);
    const updates = await getUpdates();
    expect(updates).toHaveLength(6);
    expect(updates.some((u) => u.entityUrl === '/products/3')).toBe(false);
  });

  it('Lists the updates of the active channel via the Admin API', async () => {
    const { contentAutomationUpdates } = await adminClient.query(GET_UPDATES, {
      options: { sort: { createdAt: 'DESC' } },
    });
    // Inputs 1 and 2, in 'en' and 'nl' of the default channel
    expect(contentAutomationUpdates.totalItems).toBe(4);
    expect(contentAutomationUpdates.items[0]).toMatchObject({
      strategyName: 'test-strategy',
      resultMessage: expect.stringContaining('Generated for'),
      entityUrl: expect.stringContaining('/products/'),
    });
  });

  it('Filters updates via the generated list options', async () => {
    const { contentAutomationUpdates } = await adminClient.query(GET_UPDATES, {
      options: { filter: { entityUrl: { eq: '/products/1' } } },
    });
    expect(contentAutomationUpdates.totalItems).toBe(2);
  });

  it('Runs the population via the exported helper, skipping successfully processed inputs', async () => {
    const result = await runContentAutomationPopulation(server.app);
    // Only input 3, which failed during the previous population, + skipping input, for 3 contexts
    expect(result).toEqual({ processed: 6, failed: 0 });
    expect(
      testStrategy.generateAndSaveContent.mock.calls.map(
        ([, , input]) => input.id,
      ),
    ).toEqual(['3', '3', '3']);
    const { jobs } = await adminClient.query(GET_JOBS);
    expect(jobs.totalItems).toBe(30);
    expect(await getUpdates()).toHaveLength(9);
  });

  it('Creates jobs for changed inputs when the scheduled task is executed', async () => {
    const result = await contentAutomationTask.execute(
      new Injector(server.app.get(ModuleRef)),
    );
    // All test inputs are processed, so only the skipping input, for 3 contexts
    expect(result).toEqual({ jobsCreated: 3 });
    await waitForSettledJobs(33);
    expect(skippingStrategy.generateAndSaveContent).toHaveBeenCalledTimes(3);
    expect(testStrategy.generateAndSaveContent).not.toHaveBeenCalled();
  });

  it('Continues with the next input when processing an input fails', async () => {
    inputs = [
      ...inputs,
      // A BigInt can't be serialized, so hashing this input throws
      { id: 'unhashable', text: BigInt(1) as unknown as string },
      { id: '5', text: 'e' },
    ];
    const result = await service.createJobsForChangedInputs();
    // Input 5 + skipping input, for 3 contexts
    expect(result.jobsCreated).toBe(6);
    await waitForSettledJobs(39);
    expect(
      testStrategy.generateAndSaveContent.mock.calls.map(
        ([, , input]) => input.id,
      ),
    ).toEqual(['5', '5', '5']);
    inputs = inputs.filter((i) => i.id !== 'unhashable');
  });

  it('Continues with other contexts and strategies when loading inputs fails', async () => {
    load = (ctx) =>
      ctx.languageCode === 'nl'
        ? Promise.reject(new Error('Failed to load inputs'))
        : Promise.resolve([...inputs, { id: '6', text: 'f' }]);
    const result = await service.createJobsForChangedInputs();
    // Input 6 for the 2 'en' contexts + skipping input, for 3 contexts
    expect(result.jobsCreated).toBe(5);
    await waitForSettledJobs(44);
    expect(
      testStrategy.generateAndSaveContent.mock.calls
        .map(([ctx]) => ctxKey(ctx))
        .sort(),
    ).toEqual(['__default_channel__:en', 'second-channel:en']);
    expect(skippingStrategy.generateAndSaveContent).toHaveBeenCalledTimes(3);
  });

  it('Passes a ctx to jobs that can be used to load variants with prices', async () => {
    inputs = [...inputs, { id: '7', text: 'g' }];
    generate = async (ctx) => {
      // Throws 'no-active-tax-zone' when the ctx doesn't have the tax zones of its channel
      const variants = await server.app.get(ProductVariantService).findAll(ctx);
      const prices = variants.items.map((v) => v.priceWithTax).join(',');
      return { resultMessage: `${ctx.channel.code}:${prices}` };
    };
    await service.createJobsForChangedInputs();
    await waitForSettledJobs(50);
    const messages = (await getUpdates())
      .filter((u) => u.hash === defaultHash({ id: '7', text: 'g' }))
      .map((u) => u.resultMessage);
    // The second channel has no products assigned, so it has no prices
    expect(messages).toHaveLength(3);
    expect(messages).toContain('second-channel:');
    const defaultChannelMessages = messages.filter((m) =>
      m?.startsWith('__default_channel__:'),
    );
    expect(defaultChannelMessages).toHaveLength(2);
    expect(
      defaultChannelMessages.every((m) => /^__default_channel__:\d+/.test(m!)),
    ).toBe(true);
  });

  it('Only regenerates the context in which an input changed', async () => {
    load = (ctx) =>
      Promise.resolve(
        inputs.map((i) =>
          i.id === '1' && ctx.languageCode === 'nl'
            ? { ...i, text: 'changed in nl only' }
            : i,
        ),
      );
    const result = await service.createJobsForChangedInputs();
    // Input 1 for the 'nl' context + skipping input, for 3 contexts
    expect(result.jobsCreated).toBe(4);
    await waitForSettledJobs(54);
    expect(
      testStrategy.generateAndSaveContent.mock.calls.map(
        ([ctx, , input]) => `${ctxKey(ctx)}:${input.text}`,
      ),
    ).toEqual(['__default_channel__:nl:changed in nl only']);
  });

  it('Stores state for a result without message and entity URL', async () => {
    inputs = [...inputs, { id: '8', text: 'h' }];
    generate = () => Promise.resolve({});
    await service.createJobsForChangedInputs();
    // The Dutch input for entity 1 also reverts to its previous value.
    await waitForSettledJobs(61);
    const updates = (await getUpdates()).filter(
      (u) => u.hash === defaultHash({ id: '8', text: 'h' }),
    );
    expect(updates).toHaveLength(3);
    expect(updates.every((u) => !u.resultMessage && !u.entityUrl)).toBe(true);
  });

  it('Lists only the updates of the active channel', async () => {
    const secondChannel = await server.app
      .get(ChannelService)
      .getChannelFromToken('second-channel-token');
    const allUpdates = await getUpdates();
    const secondChannelUpdates = allUpdates.filter(
      (u) => u.channelId === String(secondChannel.id),
    );
    adminClient.setChannelToken('second-channel-token');
    const { contentAutomationUpdates } = await adminClient.query(GET_UPDATES, {
      options: { take: 100 },
    });
    adminClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
    expect(contentAutomationUpdates.totalItems).toBe(
      secondChannelUpdates.length,
    );
    expect(contentAutomationUpdates.totalItems).toBeGreaterThan(0);
    expect(contentAutomationUpdates.totalItems).toBeLessThan(allUpdates.length);
  });

  it('Rejects listing updates without the required permission', async () => {
    await adminClient.asAnonymousUser();
    await expect(adminClient.query(GET_UPDATES)).rejects.toThrow(
      'not currently authorized',
    );
    await adminClient.asSuperAdmin();
  });

  it('Regenerates when input is reverted to a previous state', async () => {
    const ctx = await server.app
      .get(RequestContextService)
      .create({ apiType: 'admin' });
    const strategy: ContentAutomationStrategy<{ id: string; text: string }> = {
      name: 'reversion-test',
      loadInputData: async () => [],
      generateAndSaveContent: vi.fn(async () => ({})),
    };
    const original = { id: 'reversion', text: 'a' };
    const changed = { id: 'reversion', text: 'b' };
    for (const input of [original, changed, original, original]) {
      await service.generateAndStore(ctx, strategy, input, defaultHash(input));
    }
    expect(strategy.generateAndSaveContent).toHaveBeenCalledTimes(3);
    const updates = (await getUpdates()).filter(
      (u) => u.strategyName === strategy.name,
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      entityId: original.id,
      hash: defaultHash(original),
    });
  });

  it('Has a timeout longer than the default 60 seconds of the scheduler', () => {
    expect(contentAutomationTask.options.timeout).toBe('1h');
  });

  it('Rejects duplicate strategy names at application startup', async () => {
    const strategies = ContentAutomationPlugin.options.automationStrategies;
    strategies.push(testStrategy);
    try {
      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        'Duplicates: test-strategy',
      );
    } finally {
      strategies.pop();
    }
  });

  it('Throws on duplicate strategy names', () => {
    expect(() =>
      ContentAutomationPlugin.init({
        automationStrategies: [testStrategy, testStrategy],
      }),
    ).toThrow('Duplicates: test-strategy');
  });

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});
