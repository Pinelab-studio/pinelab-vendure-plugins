import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { describe, beforeAll, it, expect } from 'vitest';
import { AnonymizedOrderPlugin } from '../src/plugin';
import { createSettledOrder } from '../../test/src/shop-utils';
import { ANONYMIZED_ORDER_QUERY, GET_ACTIVE_ORDER } from './helpers';

describe('Customer managed groups', function () {
  let server: TestServer;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        AnonymizedOrderPlugin.init({
          anonymizeOrderFn: (order) => {
            order.couponCodes = [];
          },
        }),
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });

    ({ server, shopClient } = createTestEnvironment(config));
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
    serverStarted = true;
  }, 60000);
  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });
  describe('Anonymize Order Plugin', async () => {
    it('Should anonymize Order', async () => {
      const setteledOrder = (await createSettledOrder(shopClient, 1)) as any;
      expect(setteledOrder?.code).toBeDefined();
      expect(setteledOrder?.customer?.firstName).toBeDefined();
      expect(setteledOrder?.billingAddress?.fullName).toBeDefined();
      expect(setteledOrder?.shippingAddress?.fullName).toBeDefined();
      const { anonymizedOrder } = await shopClient.query(
        ANONYMIZED_ORDER_QUERY,
        {
          orderCode: setteledOrder.code,
          emailAddress: setteledOrder.customer?.emailAddress,
        },
      );
      expect(anonymizedOrder?.customer).toBeNull();
      expect(anonymizedOrder?.billingAddress?.fullName).toBeNull();
      expect(anonymizedOrder?.shippingAddress?.fullName).toBeNull();
      expect(anonymizedOrder?.couponCodes?.length).toBe(0);
      for (let line of anonymizedOrder.lines) {
        expect(line.order?.customer).toBeUndefined();
        expect(line.order?.billingAddress?.fullName).toBeUndefined();
        expect(line.order?.shippingAddress?.fullName).toBeUndefined();
      }
    });
  });
});
