import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import {
  EBoekhoudenConfig,
  EBoekhoudenConfigQuery,
  EBoekhoudenPlugin,
  UpdateEBoekhoudenConfigMutation,
  UpdateEBoekhoudenConfigMutationVariables,
} from '../src';
import {
  eBoekhoudenConfigQuery,
  updateEBoekhoudenConfigMutation,
} from '../src/ui/queries.graphql';
import { createSettledOrder } from '../../test/src/admin-utils';
import nock from 'nock';

jest.setTimeout(20000);

describe('Goedgepickt plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  const eBoekhoudenConfig: EBoekhoudenConfig = {
    contraAccount: '8010',
    account: '1010',
    enabled: true,
    secret1: 'secret1234',
    secret2: 'secret456',
    username: 'testUsername',
  };

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        adminListQueryLimit: 10000,
        port: 3105,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [EBoekhoudenPlugin],
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
    await adminClient.asSuperAdmin();
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Should get null', async () => {
    const { eBoekhoudenConfig: result } =
      await adminClient.query<EBoekhoudenConfigQuery>(eBoekhoudenConfigQuery);
    expect(result).toBeNull();
  });

  it('Should save config', async () => {
    const { updateEBoekhoudenConfig: result } = await adminClient.query<
      UpdateEBoekhoudenConfigMutation,
      UpdateEBoekhoudenConfigMutationVariables
    >(updateEBoekhoudenConfigMutation, { input: eBoekhoudenConfig });
    expect(result?.enabled).toBe(eBoekhoudenConfig.enabled);
    expect(result?.secret1).toBe(eBoekhoudenConfig.secret1);
    expect(result?.secret2).toBe(eBoekhoudenConfig.secret2);
    expect(result?.username).toBe(eBoekhoudenConfig.username);
    expect(result?.contraAccount).toBe(eBoekhoudenConfig.contraAccount);
    expect(result?.account).toBe(eBoekhoudenConfig.account);
  });

  it('Should get config', async () => {
    const { eBoekhoudenConfig: result } =
      await adminClient.query<EBoekhoudenConfigQuery>(eBoekhoudenConfigQuery);
    expect(result?.enabled).toBe(eBoekhoudenConfig.enabled);
    expect(result?.secret1).toBe(eBoekhoudenConfig.secret1);
    expect(result?.secret2).toBe(eBoekhoudenConfig.secret2);
    expect(result?.username).toBe(eBoekhoudenConfig.username);
  });

  it('Should send order to e-Boekhouden', async () => {
    const payloads = [];
    nock('https://soap.e-boekhouden.nl/')
      .persist(true)
      .get(/.*/, (body) => {
        payloads.push(body);
        return true;
      })
      .reply(200, { webhookSecret: 'test-secret' });
    const order = await createSettledOrder(shopClient, 1);
    expect(payloads.length).toBeGreaterThan(1);
  });

  afterAll(() => {
    return server.destroy();
  });
});
