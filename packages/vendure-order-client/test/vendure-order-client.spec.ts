import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  SimpleGraphQLClient,
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { gql } from 'graphql-request';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { VendureOrderClient, VendureOrderEvent } from '../src/';
import { initialData } from './initial-data';
import { createPromotionMutation } from './test-utils';
import { createPromotion, getOrder } from '../../test/src/admin-utils';

// import {Ad} from '@vendure/testing';

const storage: any = {};
const window = {
  localStorage: {
    getItem: (key: string) => storage[key],
    setItem: (key: string, data: any) => (storage[key] = data),
    removeItem: (key: string) => (storage[key] = undefined),
  },
};
vi.stubGlobal('window', window);

// order.history is not included by default, so we use it to test additionalOrderFields
const additionalOrderFields = gql`
  fragment AdditionalOrderFields on Order {
    history {
      totalItems
    }
  }
`;
type AdditionalOrderFields = { history: { totalItems: number } };

let client: VendureOrderClient<AdditionalOrderFields>;
let latestEmittedEvent: [string, VendureOrderEvent];

/**
 * T_2 is used as test product variant
 * T_1 is used as test order line
 */
describe('Vendure order client', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let couponCodeName = 'couponCodeName';

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
    });

    ({ server, adminClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: path.join(__dirname, './product-import.csv'),
    });
  }, 60000);

  it('Starts the server successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined;
  });

  it('Create a promotion', async () => {
    await adminClient.asSuperAdmin();
    const promotion = await createPromotion(
      adminClient as any,
      couponCodeName,
      'order_fixed_discount',
      [
        {
          name: 'discount',
          value: '10',
        },
      ]
    );
    expect(promotion.name).toBe(couponCodeName);
    expect(promotion.couponCode).toBe(couponCodeName);
  });

  it('Creates a client', async () => {
    client = new VendureOrderClient<AdditionalOrderFields>(
      'http://localhost:3050/shop-api',
      'channel-token',
      additionalOrderFields
    );
    expect(client).toBeInstanceOf(VendureOrderClient);
    expect(client.activeOrder).toBeUndefined();
    expect(client.eventBus).toBeDefined();
    client.eventBus.on(
      '*',
      (eventType, e) => (latestEmittedEvent = [eventType, e])
    );
  });

  describe('Cart management', () => {
    it('Adds an item to order', async () => {
      const order = await client.addItemToOrder('T_2', 1);
      expect(order?.lines[0].quantity).toBe(1);
      expect(order?.lines[0].productVariant.id).toBe('T_2');
    });

    it('Emits "item-added" event, with quantity 1', async () => {
      const [eventType, event] = latestEmittedEvent;
      expect(eventType).toEqual('item-added');
      expect(event).toEqual({
        productVariantIds: ['T_2'],
        quantity: 1,
      });
    });

    it('Retrieves active order with specified additional fields', async () => {
      const order = await client.getActiveOrder();
      expect(order?.lines[0].quantity).toBe(1);
      expect(order?.lines[0].productVariant.id).toBe('T_2');
      expect(order?.history.totalItems).toBe(1);
    });

    it('Increases quantity from 1 to 3', async () => {
      const order = await client.adjustOrderLine('T_1', 3);
      expect(order?.lines[0].quantity).toBe(3);
    });

    it('Emits "item-added" event, with quantity 2', async () => {
      const [eventType, event] = latestEmittedEvent;
      expect(eventType).toEqual('item-added');
      expect(event).toEqual({
        productVariantIds: ['T_2'],
        quantity: 2,
      });
    });

    it('Removes the order line', async () => {
      const order = await client.removeOrderLine('T_1');
      expect(order?.lines.length).toBe(0);
    });

    it('Emits "item-removed" event, with quantity 3', async () => {
      const [eventType, event] = latestEmittedEvent;
      expect(eventType).toEqual('item-removed');
      expect(event).toEqual({
        productVariantIds: ['T_2'],
        quantity: 3,
      });
    });

    it('Adds an item to order for the second time', async () => {
      const order = await client.addItemToOrder('T_2', 1);
      expect(order?.lines[0].quantity).toBe(1);
      expect(order?.lines[0].productVariant.id).toBe('T_2');
    });

    it('Removes all order lines', async () => {
      const order = await client.removeAllOrderLines();
      expect(order?.lines.length).toBe(0);
    });

    it('Emits "item-removed" event, with quantity 1', async () => {
      const [eventType, event] = latestEmittedEvent;
      expect(eventType).toEqual('item-removed');
      expect(event).toEqual({
        productVariantIds: ['T_2'],
        quantity: 1,
      });
    });
  });

  describe('Guest checkout', () => {
    it('Adds an item to order', async () => {
      const order = await client.addItemToOrder('T_2', 1);
      expect(order?.lines[0].quantity).toBe(1);
      expect(order?.lines[0].productVariant.id).toBe('T_2');
    });

    it('Applies invalid coupon', async () => {
      const order = await client.applyCouponCode('fghj');
      expect(order?.couponCodes?.length).toEqual(0);
    });

    it('Applies valid coupon', async () => {
      const order = await client.applyCouponCode(couponCodeName);
      expect(order?.couponCodes?.length).toEqual(1);
    });

    it('Emits "coupon-code-applied" event', async () => {
      const [eventType, event] = latestEmittedEvent;
      expect(eventType).toEqual('coupon-code-applied');
      expect(event).toEqual({
        couponCode: couponCodeName,
      });
    });

    it('Removes coupon', async () => {
      const order = await client.removeCouponCode(couponCodeName);
      expect(order?.couponCodes?.length).toEqual(0);
    });

    it('Emits "coupon-code-removed" event', async () => {
      const [eventType, event] = latestEmittedEvent;
      expect(eventType).toEqual('coupon-code-removed');
      expect(event).toEqual({
        couponCode: couponCodeName,
      });
    });

    it.skip('Adds customer', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds shipping address', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds billing address', async () => {
      expect(false).toBe(true);
    });

    it.skip('Sets shipping method', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds payment', async () => {
      expect(false).toBe(true);
    });

    it.skip('Gets order by code', async () => {
      expect(false).toBe(true);
    });
  });

  describe('Registered customer checkout', () => {
    it.skip('Register as customer', async () => {
      expect(false).toBe(true);
    });

    it.skip('Login as customer', async () => {
      expect(false).toBe(true);
    });

    // TODO dont add shipping address etc
  });

  describe('Account management', () => {
    // TODO: reset password, update profile

    it.skip('Placeholder', async () => {
      expect(false).toBe(true);
    });
  });

  afterAll(() => {
    return server.destroy();
  });
});
