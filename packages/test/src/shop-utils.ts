import { SimpleGraphQLClient } from '@vendure/testing';
import {
  AddItemToOrder,
  AddPaymentToOrder,
  AddPaymentToOrderMutation,
  ErrorCode,
  SetShippingAddress,
  SetShippingAddressMutationVariables,
  SetShippingMethod,
  TransitionToState,
  TransitionToStateMutation,
  TransitionToStateMutationVariables,
} from './generated/shop-graphql';
import { ErrorResult, Order } from '@vendure/core';
import { testPaymentMethod } from './test-payment-method';

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
  shippingMethodId: string | number,
  authorizeFirst = true
): Promise<Order> {
  if (authorizeFirst) {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
  }
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
