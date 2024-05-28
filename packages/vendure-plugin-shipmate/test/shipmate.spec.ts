import {
  AutoIncrementIdStrategy,
  DefaultLogger,
  LogLevel,
  OrderService,
  RequestContext,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
  SimpleGraphQLClient,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { afterAll, beforeAll, expect, it, describe, vi } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import nock from 'nock';

import { VendureShipmatePlugin } from '../src/shipmate.plugin';
import { newShipment } from './test-helpers';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import { ShipmateConfigService } from '../src/api/shipmate-config.service';
import axios from 'axios';
import type { TrackingEventPayload } from '../src/types';
import { authToken } from './test-helpers';

vi.mock('@vendure/core/dist/common/generate-public-id', () => ({
  generatePublicId: vi.fn().mockImplementation(() => 'FBJYSHC7WTRQEA14'),
}));

describe('Picklists plugin', function () {
  let server: TestServer;
  let shopClient: SimpleGraphQLClient;
  let ctx: RequestContext;
  const port = 3105;
  const nockBaseUrl = 'https://api-staging.shipmate.co.uk/v1.2';
  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      apiOptions: {
        port,
      },
      plugins: [
        VendureShipmatePlugin.init({
          shipmateApiUrl: nockBaseUrl,
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
      customerCount: 2,
    });
    ctx = await getSuperadminContext(server.app);
    await server.app
      .get(ShipmateConfigService)
      .upsertConfig(
        ctx,
        'SHIPMATE_API_KEY',
        'SHIPMATE_USERNAME',
        'SHIPMATE_PASSWORD',
        [authToken]
      );
    nock(nockBaseUrl)
      .post('/tokens', (reqBody) => {
        return true;
      })
      .reply(200, {
        message: 'Login Successful',
        data: {
          token: '749a75e3c1048965c498017efae8051f',
        },
      })
      .persist();
  }, 60000);

  it('Should start successfully', () => {
    expect(server.app.getHttpServer()).toBeDefined();
  });

  it('Should create a Shipment when an Order is placed', async () => {
    nock(nockBaseUrl)
      .post('/shipments', (reqBody) => {
        return true;
      })
      .reply(200, { data: [newShipment], message: 'Shipment Created' })
      .persist();
    await createSettledOrder(shopClient, 'T_1');
    const orderService = server.app.get(OrderService);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const detailedOrder = await orderService.findOne(ctx, 1);
    expect(detailedOrder?.customFields?.shipmateReference).toBe(
      newShipment.shipment_reference
    );
  });

  it('Should mark Order as Shipped when receiving "TRACKING_COLLECTED" event', async () => {
    const result = await axios.post(`http://localhost:${port}/shipmate`, <
      TrackingEventPayload
    >{
      auth_token: authToken,
      event: 'TRACKING_COLLECTED',
      shipment_reference: newShipment.shipment_reference,
    });
    expect(result.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const orderService = server.app.get(OrderService);
    const detailedOrder = await orderService.findOne(ctx, 1, ['fulfillments']);
    expect(detailedOrder?.state).toBe('Shipped');
    expect(detailedOrder?.fulfillments?.length).toBeGreaterThan(0);
  });

  it('Should mark Order as Delivered when receiving "TRACKING_DELIVERED" event', async () => {
    const result = await axios.post(`http://localhost:${port}/shipmate`, <
      TrackingEventPayload
    >{
      auth_token: authToken,
      event: 'TRACKING_DELIVERED',
      shipment_reference: newShipment.shipment_reference,
    });
    expect(result.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const orderService = server.app.get(OrderService);
    const detailedOrder = await orderService.findOne(ctx, 1, ['fulfillments']);
    expect(detailedOrder?.state).toBe('Delivered');
    expect(detailedOrder?.fulfillments?.length).toBeGreaterThan(0);
  });

  afterAll(() => {
    return server.destroy();
  });
});
