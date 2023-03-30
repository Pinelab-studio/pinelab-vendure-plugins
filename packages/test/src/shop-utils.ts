import { SimpleGraphQLClient } from '@vendure/testing';
import {
  AddItemToOrder,
  AddPaymentToOrder,
  AddPaymentToOrderMutation,
  ErrorCode,
  GET_PRODUCT_SIMPLE,
  SetShippingAddress,
  SetShippingAddressMutationVariables,
  SetShippingMethod,
  TransitionToState,
  TransitionToStateMutation,
  TransitionToStateMutationVariables,
  CreateAddressInput,
  MutationSetOrderBillingAddressArgs,
  ActiveOrderResult,
  SET_ORDER_BILLING_ADDRESS,
} from './generated/shop-graphql';
import { ErrorResult, ID, Order } from '@vendure/core';
import { testPaymentMethod } from './test-payment-method';
import {
  Product,
  ProductList,
  QueryProductArgs,
  QueryProductsArgs,
} from './generated/admin-graphql';

/**
 * Set active order to have an address and a shippingmethod
 */
export async function setAddressAndShipping(
  shopClient: SimpleGraphQLClient,
  shippingMethodId: string | number,
  address?: SetShippingAddressMutationVariables
) {
  await shopClient.query(
    SetShippingAddress,
    address ?? {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: '8923CP',
        countryCode: 'NL',
      },
    }
  );
  await shopClient.query(SetShippingMethod, {
    id: shippingMethodId,
  });
}

/**
 * Proceed the active order of current shopClient to proceed to ArrangingPayment
 */
export async function proceedToArrangingPayment(
  shopClient: SimpleGraphQLClient,
  shippingMethodId: string | number,
  address?: SetShippingAddressMutationVariables
) {
  await setAddressAndShipping(shopClient, shippingMethodId, address);
  const result = await shopClient.query<
    TransitionToStateMutation,
    TransitionToStateMutationVariables
  >(TransitionToState, { state: 'ArrangingPayment' });
  return result.transitionOrderToState;
}

/**
 * Add payment to active order by given code
 */
export async function addPaymentToOrder(
  shopClient: SimpleGraphQLClient,
  code: string
): Promise<AddPaymentToOrderMutation['addPaymentToOrder']> {
  const { addPaymentToOrder } = await shopClient.query(AddPaymentToOrder, {
    input: {
      method: code,
      metadata: {
        baz: 'quux',
      },
    },
  });
  return addPaymentToOrder;
}

/**
 * Add item to active order
 */
export async function addItem(
  shopClient: SimpleGraphQLClient,
  variantId: string,
  quantity: number
): Promise<Order> {
  const { addItemToOrder } = await shopClient.query(AddItemToOrder, {
    productVariantId: variantId,
    quantity,
  });
  return addItemToOrder;
}

export async function createSettledOrder(
  shopClient: SimpleGraphQLClient,
  shippingMethodId: string | number
): Promise<Order> {
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await addItem(shopClient, 'T_1', 1);
  await addItem(shopClient, 'T_2', 2);
  const res = await proceedToArrangingPayment(shopClient, shippingMethodId, {
    input: {
      fullName: 'Martinho Pinelabio',
      streetLine1: 'Verzetsstraat',
      streetLine2: '12a',
      city: 'Liwwa',
      postalCode: '8923CP',
      countryCode: 'NL',
    },
  });
  if ((res as ErrorResult)?.errorCode) {
    console.error(JSON.stringify(res));
    throw Error((res as ErrorResult).errorCode);
  }
  return (await addPaymentToOrder(shopClient, testPaymentMethod.code)) as Order;
}

export async function createSettledOrderForVariants(
  shopClient: SimpleGraphQLClient,
  variants: { id: string; quantity: number }[],
  shippingMethodId: string | number
): Promise<Order> {
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  for (const v of variants) {
    await addItem(shopClient, v.id, v.quantity);
  }
  const res = await proceedToArrangingPayment(shopClient, shippingMethodId, {
    input: {
      fullName: 'Martinho Pinelabio',
      streetLine1: 'Verzetsstraat',
      streetLine2: '12a',
      city: 'Liwwa',
      postalCode: '8923CP',
      countryCode: 'NL',
    },
  });
  if ((res as ErrorResult)?.errorCode) {
    console.error(JSON.stringify(res));
    throw Error((res as ErrorResult).errorCode);
  }
  return (await addPaymentToOrder(shopClient, testPaymentMethod.code)) as Order;
}
export async function getProductWithId(
  shopClient: SimpleGraphQLClient,
  id: string
): Promise<Product> {
  return await shopClient.query<Product, QueryProductArgs>(GET_PRODUCT_SIMPLE, {
    id: id,
  });
}
