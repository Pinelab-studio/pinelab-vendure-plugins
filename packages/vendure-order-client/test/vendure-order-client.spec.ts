import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { gql } from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { addItem } from '../../test/src/shop-utils';
import {
  ActiveOrderFieldsFragment,
  CreateAddressInput,
  CreateCustomerInput,
  ErrorResult,
  PaymentInput,
  Success,
  VendureOrderClient,
  VendureOrderEvent,
} from '../src/';
import { initialData } from './initial-data';
import { testPaymentMethodHandler } from './test-payment-method-handler';

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
const additionalOrderFields = `
  fragment AdditionalOrderFields on Order {
    history {
      totalItems
    }
  }
`;
interface AdditionalOrderFields {
  history: { totalItems: number };
}

let client: VendureOrderClient<AdditionalOrderFields>;
let latestEmittedEvent: [string, VendureOrderEvent];

/**
 * T_2 is used as test product variant
 * T_1 is used as test order line
 */
describe('Vendure order client', () => {
  let server: TestServer;
  const couponCodeName = 'couponCodeName';
  let activeOrderCode: string | undefined;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethodHandler],
      },
      authOptions: {
        requireVerification: false,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
    });
    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: path.join(__dirname, './product-import.csv'),
    });
  }, 60000);

  it('Starts the server successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined();
  });

  it('Creates a promotion', async () => {
    await adminClient.asSuperAdmin();
    const { createPromotion } = await adminClient.query(
      gql`
        mutation CreatePromotionMutation($name: String!) {
          createPromotion(
            input: {
              enabled: true
              couponCode: $name
              translations: [{ languageCode: en, name: $name }]
              conditions: []
              actions: [
                {
                  code: "order_fixed_discount"
                  arguments: [{ name: "discount", value: "10" }]
                }
              ]
            }
          ) {
            ... on Promotion {
              id
              name
              couponCode
            }
            ... on ErrorResult {
              errorCode
            }
          }
        }
      `,
      { name: couponCodeName }
    );
    expect(createPromotion.name).toBe(couponCodeName);
    expect(createPromotion.couponCode).toBe(couponCodeName);
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
      activeOrderCode = order?.code;
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
      const result = await client.applyCouponCode('fghj');
      expect((result as ErrorResult).errorCode).toBeDefined();
    });

    it('Applies valid coupon', async () => {
      const order = await client.applyCouponCode(couponCodeName);
      expect((order as ActiveOrderFieldsFragment)?.couponCodes?.length).toEqual(
        1
      );
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

    it('Adds customer', async () => {
      const createCustomerInput: CreateCustomerInput = {
        emailAddress: 'example@gmail.com',
        firstName: 'Mein',
        lastName: 'Zohn',
      };
      const result = await client.setCustomerForOrder(createCustomerInput);
      const customer = (result as ActiveOrderFieldsFragment).customer;
      if (!customer) {
        throw Error('Failed to create customer');
      }
      expect(customer.emailAddress).toEqual(createCustomerInput.emailAddress);
      expect(customer.firstName).toEqual(createCustomerInput.firstName);
      expect(customer.lastName).toEqual(createCustomerInput.lastName);
    });

    it('Adds shipping address', async () => {
      const addShippingAddressInput: CreateAddressInput = {
        streetLine1: ' Stree Line in Ethiopia',
        countryCode: 'GB',
      };
      const result = await client.setOrderShippingAddress(
        addShippingAddressInput
      );
      const shippingAddress = (result as ActiveOrderFieldsFragment)
        .shippingAddress;
      if (!shippingAddress) {
        throw Error('Failed to set shipping address');
      }
      expect(shippingAddress.country).toEqual(
        regionNames.of(addShippingAddressInput.countryCode)
      );
      expect(shippingAddress.streetLine1).toEqual(
        addShippingAddressInput.streetLine1
      );
    });

    it('Adds billing address', async () => {
      const addBillingAddressInput: CreateAddressInput = {
        streetLine1: 'ANother Stree Line in Ethiopia',
        countryCode: 'GB',
      };
      const result = await client.addBillingAddress(addBillingAddressInput);
      const billingAddress = (result as ActiveOrderFieldsFragment)
        .billingAddress;
      if (!billingAddress) {
        throw Error('Failed to set billing address');
      }
      expect(billingAddress.country).toEqual(
        regionNames.of(addBillingAddressInput.countryCode)
      );
      expect(billingAddress.streetLine1).toEqual(
        addBillingAddressInput.streetLine1
      );
    });

    it('Sets shipping method', async () => {
      const result = await client.setOrderShippingMethod(['T_1']);
      expect(
        (result as ActiveOrderFieldsFragment).shippingLines?.length
      ).toEqual(1);
      expect(
        (result as ActiveOrderFieldsFragment).shippingLines?.find(
          (s) => s.shippingMethod?.id === 'T_1'
        )
      ).toBeDefined();
    });

    it('Transitions order to arranging payment state', async () => {
      const result = await client.transitionOrderToState('ArrangingPayment');
      expect((result as ActiveOrderFieldsFragment).state).toBe(
        'ArrangingPayment'
      );
    });

    it('Adds payment', async () => {
      const addPaymentInput: PaymentInput = {
        method: 'test-payment',
        metadata: {
          id: 0,
        },
      };
      const result = await client.addPayment(addPaymentInput);
      expect(
        (result as ActiveOrderFieldsFragment).payments?.length
      ).toBeGreaterThan(0);
      const testPayment = (result as ActiveOrderFieldsFragment).payments?.find(
        (p) => p.method === addPaymentInput.method
      );
      expect(testPayment?.metadata.public.id).toEqual(
        addPaymentInput.metadata.id
      );
    });

    it('Gets order by code', async () => {
      if (!activeOrderCode) {
        throw Error('Active order code is not defined');
      }
      const result = await client.getOrderByCode(activeOrderCode);
      expect(activeOrderCode).toEqual(result.code);
    });
  });

  describe('Registered customer checkout', () => {
    const createNewCustomerInput = {
      emailAddress: `test${Math.random()}@xyz.com`,
      password: '1qaz2wsx',
    };
    /*  */
    it('Register as customer', async () => {
      const result = await client.registerCustomerAccount(
        createNewCustomerInput
      );
      expect((result as Success)?.success).toBe(true);
      await shopClient.asUserWithCredentials(
        createNewCustomerInput.emailAddress,
        createNewCustomerInput.password
      );
      await addItem(shopClient, 'T_1', 2);
      const { activeOrder } = await shopClient.query(gql`
        {
          activeOrder {
            lines {
              id
              productVariant {
                id
              }
            }
            customer {
              id
              emailAddress
            }
          }
        }
      `);
      expect(activeOrder.customer.emailAddress).toBe(
        createNewCustomerInput.emailAddress
      );
    });

    it('Login with the new customer', async () => {
      const { login } = await shopClient.query(
        gql`
          mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
              ... on CurrentUser {
                identifier
              }
            }
          }
        `,
        {
          username: createNewCustomerInput.emailAddress,
          password: createNewCustomerInput.password,
        }
      );
      expect(login.identifier).toBe(createNewCustomerInput.emailAddress);
    });
  });

  afterAll(async () => {
    await server.destroy();
  });
});
