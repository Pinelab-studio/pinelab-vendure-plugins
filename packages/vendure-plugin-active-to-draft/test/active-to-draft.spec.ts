import { DefaultLogger, LogLevel, mergeConfig, OrderLine } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { ActiveToDraftPlugin } from '../src/active-to-draft.plugin';
import { convertToDraftMutation } from './test-helper';
jest.setTimeout(10000);

describe('Customer managed groups', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [ActiveToDraftPlugin],
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
      customerCount: 5,
    });
    await adminClient.asSuperAdmin();
  }, 60000);

  it('Should start successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined;
  });

  it('Should change active order to draft order', async () => {
    const testActiveOrder = await addItem(shopClient, 'T_1', 1);
    const { convertToDraft: draftOrder } = await adminClient.query(
      convertToDraftMutation,
      {
        id: testActiveOrder.id,
      }
    );
    console.log(draftOrder);
    expect(draftOrder.state).toBe('Draft');
    expect(draftOrder.lines.length).toBe(testActiveOrder.lines.length);
    for (let line of testActiveOrder.lines) {
      expect(
        draftOrder.lines.some(
          (l: OrderLine) => l.productVariant.id == line.productVariant.id
        )
      ).toBe(true);
    }
  });
  it('Should not change non active order to draft order', async () => {
    const testNonActiveOrder = await createSettledOrder(shopClient, 1);
    try {
      const { convertToDraft: draftOrder } = await adminClient.query(
        convertToDraftMutation,
        {
          id: testNonActiveOrder.id,
        }
      );
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'Only active orders can be changed to a draft order'
      );
    }
  });
});
