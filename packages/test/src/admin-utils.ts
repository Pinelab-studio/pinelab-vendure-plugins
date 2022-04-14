import {
  defaultShippingCalculator,
  defaultShippingEligibilityChecker,
  LanguageCode,
} from '@vendure/core';
import { Fulfillment } from '@vendure/common/lib/generated-types';
import { SimpleGraphQLClient } from '@vendure/testing';
import { Order } from '@vendure/core';
import {
  CreateFulfillment,
  CreateShippingMethod,
  OrderQuery,
  Order as OrderGraphql,
} from './generated/admin-graphql';
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from './shop-utils';
import { testPaymentMethod } from './test-payment-method';

/**
 *
 */
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
  items: [variantId: string, quantity: number][]
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
        arguments: [],
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
