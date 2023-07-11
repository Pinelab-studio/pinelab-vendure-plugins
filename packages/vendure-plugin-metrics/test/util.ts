import { Order, ErrorResult } from '@vendure/core';
import { SimpleGraphQLClient } from '@vendure/testing';
import { addItem, addPaymentToOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  SetShippingAddress,
  SetShippingAddressMutationVariables,
  SetShippingMethod,
  TransitionToState,
  TransitionToStateMutation,
  TransitionToStateMutationVariables,
} from '../../test/src/generated/shop-graphql';
import { gql } from 'graphql-tag';
export async function setAddressAndShipping(
  shopClient: SimpleGraphQLClient,
  shippingMethodId: string | number,
  address?: SetShippingAddressMutationVariables
): Promise<void> {
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
  await shopClient.query(
    gql`
      mutation SetShippingMethod($id: [ID!]!) {
        setOrderShippingMethod(shippingMethodId: $id) {
          ... on ErrorResult {
            errorCode
            message
          }
        }
      }
    `,
    {
      id: [shippingMethodId],
    }
  );
}
export async function proceedToArrangingPayment(
  shopClient: SimpleGraphQLClient,
  shippingMethodId: string | number,
  address?: SetShippingAddressMutationVariables
): Promise<TransitionToStateMutation['transitionOrderToState']> {
  await setAddressAndShipping(shopClient, shippingMethodId, address);
  const result = await shopClient.query<
    TransitionToStateMutation,
    TransitionToStateMutationVariables
  >(TransitionToState, { state: 'ArrangingPayment' });
  return result.transitionOrderToState;
}
export async function createSettledOrder(
  shopClient: SimpleGraphQLClient,
  shippingMethodId: string | number,
  authorizeFirst = true,
  variants: Array<{ id: string; quantity: number }> = [
    { id: 'T_1', quantity: 1 },
    { id: 'T_2', quantity: 2 },
  ]
): Promise<Order> {
  if (authorizeFirst) {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
  }
  for (const v of variants) {
    await addItem(shopClient as any, v.id, v.quantity);
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
  return (await addPaymentToOrder(
    shopClient as any,
    testPaymentMethod.code
  )) as Order;
}
