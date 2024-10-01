import {
  DefaultLogger,
  DefaultOrderCodeStrategy,
  isGraphQlErrorResult,
  LogLevel,
  mergeConfig,
  Order,
  OrderService,
  RequestContext,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import nock from 'nock';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initialData } from '../../test/src/initial-data';

import {
  ModifyOrderInput,
  MutationModifyOrderArgs,
} from '@vendure/common/lib/generated-types';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import axios from 'axios';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { ShipmateConfigService } from '../src/api/shipmate-config.service';
import { ShipmatePlugin } from '../src/shipmate.plugin';
import type { TrackingEventPayload } from '../src/types';
import {
  authToken,
  cancelShipmentResponse,
  mockShipment,
  MODIFY_ORDER,
} from './test-helpers';

/**
 * This is the order object that was passed into the `shouldSendOrder` strategy
 */
let orderFromShouldSendStrategy: Order | undefined;

describe('Shipmate plugin', async () => {
  let server: TestServer;
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
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
        ShipmatePlugin.init({
          apiUrl: nockBaseUrl,
          //only send order if the total quantity is less than 5
          shouldSendOrder: function (
            ctx: RequestContext,
            order: Order
          ): Promise<boolean> | boolean {
            orderFromShouldSendStrategy = order;
            return order.totalQuantity < 5;
          },
        }),
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });

    ({ server, shopClient, adminClient } = createTestEnvironment(config));
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
  }, 60000);

  it('Should start successfully', () => {
    expect(server.app.getHttpServer()).toBeDefined();
  });

  let order: Order | undefined;

  // Global tokens mock, neede before each API call
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
    .persist(true);

  // Global mock for outgoing requests to Shipmate API
  let shipmentRequests: any[] = [];
  nock(nockBaseUrl)
    .post('/shipments', (reqBody) => {
      shipmentRequests.push(reqBody);
      return true;
    })
    .reply(200, { data: [mockShipment], message: 'Shipment Created' })
    .persist(true);

  it('Should not create a Shipment when an Order.totalQuantity is >= 5', async () => {
    await createSettledOrder(shopClient, 'T_1', true, [
      { id: 'T_1', quantity: 2 },
      { id: 'T_2', quantity: 3 },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const orderService = server.app.get(OrderService);
    order = await orderService.findOne(ctx, 1);
    // Should not have any shipments created
    expect(shipmentRequests.length).toBe(0);
  });

  it('Should create a Shipment when an Order is placed', async () => {
    vi.spyOn(DefaultOrderCodeStrategy.prototype, 'generate').mockImplementation(
      () => mockShipment.shipment_reference
    );
    await shopClient.asAnonymousUser();
    await createSettledOrder(shopClient, 'T_1');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const orderService = server.app.get(OrderService);
    order = await orderService.findOne(ctx, 2);
    expect(shipmentRequests.length).toBe(1);
    expect(shipmentRequests[0]?.shipment_reference).toBe(order?.code);
  });

  it('Should pass the order with relations into "shouldSendOrder" strategy', async () => {
    expect(orderFromShouldSendStrategy?.customer?.emailAddress).toBeDefined();
    expect(
      orderFromShouldSendStrategy?.lines[0].productVariant.name
    ).toBeDefined();
    expect(
      orderFromShouldSendStrategy?.shippingLines[0].shippingMethod.name
    ).toBeDefined();
  });

  it('Should cancel and recreate order on Order Modification', async () => {
    const cancelShipmentScope = nock(nockBaseUrl)
      .delete(`/shipments/${mockShipment.shipment_reference}`)
      .reply(200, cancelShipmentResponse)
      .persist(true);

    const orderService = server.app.get(OrderService);
    const ctx = await getSuperadminContext(server.app);
    await adminClient.asSuperAdmin();
    // Modify an order to retrigger shipment creation/update
    try {
      const modifyOrderInput: ModifyOrderInput = {
        dryRun: true,
        orderId: 2,
        addItems: [
          {
            productVariantId: 3,
            quantity: 3,
          },
        ],
      };
      const transitionToModifyingResult = await orderService.transitionToState(
        ctx,
        2,
        'Modifying'
      );
      if (isGraphQlErrorResult(transitionToModifyingResult)) {
        throw transitionToModifyingResult.transitionError;
      }
      await adminClient.query<any, MutationModifyOrderArgs>(MODIFY_ORDER, {
        input: modifyOrderInput,
      });
      //transition Order From Modifying to ArrangingAdditionalPayment
      const transitionArrangingAdditionalPaymentResult =
        await orderService.transitionToState(
          ctx,
          2,
          'ArrangingAdditionalPayment'
        );
      if (isGraphQlErrorResult(transitionArrangingAdditionalPaymentResult)) {
        throw transitionArrangingAdditionalPaymentResult.transitionError;
      }
    } catch (e) {
      // Log why modifying order failed
      console.error(e);
      throw e;
    }
    await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
    expect(cancelShipmentScope.isDone()).toBe(true);
    // Created the shipment again
    expect(shipmentRequests.length).toBe(2);
    expect(shipmentRequests[1]?.shipment_reference).toBe(order?.code);
  });

  it('Should mark Order as Shipped when receiving "TRACKING_COLLECTED" event', async () => {
    const result = await axios.post(`http://localhost:${port}/shipmate`, <
      TrackingEventPayload
    >{
      auth_token: authToken,
      event: 'TRACKING_COLLECTED',
      order_reference: mockShipment.shipment_reference,
      shipment_reference: mockShipment.shipment_reference,
    });
    //shipmate's api expects a status of 201
    expect(result.status).toBe(201);
    // await new Promise((resolve) => setTimeout(resolve, 4000));
    const orderService = server.app.get(OrderService);
    const detailedOrder = await orderService.findOne(ctx, 2, ['fulfillments']);
    expect(detailedOrder?.state).toBe('Shipped');
    expect(detailedOrder?.fulfillments?.length).toBeGreaterThan(0);
  });

  it('Should mark Order as Delivered when receiving "TRACKING_DELIVERED" event', async () => {
    const result = await axios.post(`http://localhost:${port}/shipmate`, <
      TrackingEventPayload
    >{
      auth_token: authToken,
      event: 'TRACKING_DELIVERED',
      order_reference: mockShipment.shipment_reference,
      shipment_reference: mockShipment.shipment_reference,
    });
    //shipmate's api expects a status of 201
    expect(result.status).toBe(201);
    // await new Promise((resolve) => setTimeout(resolve, 4000));
    const orderService = server.app.get(OrderService);
    const detailedOrder = await orderService.findOne(ctx, 2, ['fulfillments']);
    expect(detailedOrder?.state).toBe('Delivered');
    expect(detailedOrder?.fulfillments?.length).toBeGreaterThan(0);
  });

  afterAll(() => {
    return server.destroy();
  });
});
