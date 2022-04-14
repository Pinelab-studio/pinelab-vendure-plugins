import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { DefaultLogger, LogLevel, mergeConfig, TaxRate } from '@vendure/core';
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
import nock from 'nock';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { createSettledOrder } from '../../test/src/shop-utils';
import { Connection } from 'typeorm';

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
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData: {
        ...initialData,
        paymentMethods: [
          {
            name: testPaymentMethod.code,
            handler: { code: testPaymentMethod.code, arguments: [] },
          },
        ],
      },
      productsCsvPath: '../test/src/products-import.csv',
      customerCount: 2,
    });
    serverStarted = true;
    await server.app
      .get(Connection)
      .getRepository(TaxRate)
      .update({ id: 2 }, { value: 21 }); // Set europe to 21
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
    const payloads: any = [];
    const savePayload = (body: any) => {
      payloads.push(body);
      return true;
    };
    // Mock OpenSession
    nock(`http://soap.e-boekhouden.nl`)
      .post(/.*/, savePayload)
      .reply(200, openSessionMock);
    // Mock AddMutatie
    nock(`http://soap.e-boekhouden.nl`)
      .post(/.*/, savePayload)
      .reply(200, addMutatieMock);
    // Close Session
    nock(`http://soap.e-boekhouden.nl`).post(/.*/, savePayload).reply(200);
    await createSettledOrder(shopClient, 1);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Delay for async events
    expect(payloads.length).toBe(3); // Open, add, close
    expect(payloads[1]).toContain('4957.37'); // Total inc tax
    expect(payloads[1]).toContain('4097.00'); // Total ex tax
    expect(payloads[1]).toContain('HOOG_VERK_21');
    expect(payloads[1]).toContain(eBoekhoudenConfig.account);
    expect(payloads[1]).toContain(eBoekhoudenConfig.contraAccount);
  });

  afterAll(() => {
    return server.destroy();
  });
});

const openSessionMock = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <soap:Body>
        <OpenSessionResponse xmlns="http://www.e-boekhouden.nl/soap">
            <OpenSessionResult>
                <ErrorMsg>
                    <LastErrorCode />
                    <LastErrorDescription />
                </ErrorMsg>
                <SessionID>{some-bogus-sessionId}</SessionID>
            </OpenSessionResult>
        </OpenSessionResponse>
    </soap:Body>
</soap:Envelope>`;

const addMutatieMock = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <soap:Body>
        <AddMutatieResponse xmlns="http://www.e-boekhouden.nl/soap">
            <AddMutatieResult>
                <ErrorMsg>
                    <LastErrorCode/>
                    <LastErrorDescription/>
                </ErrorMsg>
                <Mutatienummer>12</Mutatienummer>
            </AddMutatieResult>
        </AddMutatieResponse>
    </soap:Body>
</soap:Envelope>`;
