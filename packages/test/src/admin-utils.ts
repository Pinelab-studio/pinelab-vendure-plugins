import {
  defaultShippingCalculator,
  defaultShippingEligibilityChecker,
  LanguageCode,
} from '@vendure/core';
import { Fulfillment } from '@vendure/common/lib/generated-types';
import { SimpleGraphQLClient } from '@vendure/testing';
import {
  CreateFulfillment,
  CreateShippingMethod,
  Order as OrderGraphql,
  Orders as OrdersGraphql,
  OrderQuery,
  OrdersQuery,
} from './generated/admin-graphql';

export async function addShippingMethod(
  adminClient: SimpleGraphQLClient,
  fulfillmentHandlerCode: string,
  price = '500'
) {
  await adminClient.asSuperAdmin();
  await adminClient.query(CreateShippingMethod, {
    input: {
      code: 'test-shipping-method',
      fulfillmentHandler: fulfillmentHandlerCode,
      checker: {
        code: defaultShippingEligibilityChecker.code,
        arguments: [
          {
            name: 'orderMinimum',
            value: '0',
          },
        ],
      },
      calculator: {
        code: defaultShippingCalculator.code,
        arguments: [
          {
            name: 'rate',
            value: price,
          },
          {
            name: 'taxRate',
            value: '0',
          },
        ],
      },
      translations: [
        { languageCode: LanguageCode.en, name: 'test method', description: '' },
      ],
    },
  });
}

export async function fulfill(
  adminClient: SimpleGraphQLClient,
  handlerCode: string,
  items: [variantId: string, quantity: number][],
  args?: { name: string; value: string }[]
): Promise<Fulfillment> {
  const lines = items.map((item) => ({
    orderLineId: item[0],
    quantity: item[1],
  }));
  const { addFulfillmentToOrder } = await adminClient.query(CreateFulfillment, {
    input: {
      lines,
      handler: {
        code: handlerCode,
        arguments: args || {},
      },
    },
  });
  return addFulfillmentToOrder;
}

export async function getOrder(
  adminClient: SimpleGraphQLClient,
  orderId: string
): Promise<OrderQuery['order']> {
  const { order } = await adminClient.query(OrderGraphql, { id: orderId });
  return order;
}

export async function getAllOrders(
  adminClient: SimpleGraphQLClient
): Promise<OrdersQuery['orders']['items']> {
  const { orders } = await adminClient.query(OrdersGraphql);
  return orders.items;
}
