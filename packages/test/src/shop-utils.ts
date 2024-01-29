import { ErrorResult, Order } from '@vendure/core';
import { SimpleGraphQLClient } from '@vendure/testing';
import {
  SetBillingAddress,
  AddItemToOrder,
  AddPaymentToOrder,
  AddPaymentToOrderMutation,
  ApplyCouponCode,
  OrderFieldsFragment,
  SetShippingAddress,
  SetShippingAddressMutationVariables,
  SetShippingMethod,
  TransitionToState,
  TransitionToStateMutation,
  TransitionToStateMutationVariables,
  SetBillingAddressMutationVariables,
} from './generated/shop-graphql';
import { testPaymentMethod } from './test-payment-method';

/**
 * Set active order to have an address and a shippingmethod
 */
export async function setAddressAndShipping(
  shopClient: SimpleGraphQLClient,
  shippingMethodId: string | number,
  shippingAddress?: SetShippingAddressMutationVariables,
  billingAddress?: SetBillingAddressMutationVariables
): Promise<void> {
  const finalShippingAddress = shippingAddress ?? {
    input: {
      fullName: 'Martinho Pinelabio',
      streetLine1: 'Verzetsstraat',
      streetLine2: '12a',
      city: 'Liwwa',
      postalCode: '8923CP',
      countryCode: 'NL',
    },
  };
  await shopClient.query(SetShippingAddress, finalShippingAddress);
  if (billingAddress) {
    await shopClient.query(SetBillingAddress, billingAddress);
  }
  await shopClient.query(SetShippingMethod, {
    ids: [shippingMethodId],
  });
}

/**
 * Proceed the active order of current shopClient to proceed to ArrangingPayment
 */
export async function proceedToArrangingPayment(
  shopClient: SimpleGraphQLClient,
  shippingMethodId: string | number,
  shippingAddress: SetShippingAddressMutationVariables,
  billingAddress?: SetBillingAddressMutationVariables
): Promise<TransitionToStateMutation['transitionOrderToState']> {
  await setAddressAndShipping(
    shopClient,
    shippingMethodId,
    shippingAddress,
    billingAddress
  );
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

export async function applyCouponCode(
  shopClient: SimpleGraphQLClient,
  couponCode: string
): Promise<OrderFieldsFragment> {
  const { applyCouponCode } = await shopClient.query(ApplyCouponCode, {
    couponCode,
  });
  return applyCouponCode;
}

export async function createSettledOrder(
  shopClient: SimpleGraphQLClient,
  shippingMethodId: string | number,
  authorizeFirst = true,
  variants: Array<{ id: string; quantity: number }> = [
    { id: 'T_1', quantity: 1 },
    { id: 'T_2', quantity: 2 },
  ],
  billingAddress?: SetBillingAddressMutationVariables,
  shippingAddress?: SetShippingAddressMutationVariables
): Promise<AddPaymentToOrderMutation['addPaymentToOrder']> {
  if (authorizeFirst) {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
  }
  for (const v of variants) {
    await addItem(shopClient, v.id, v.quantity);
  }
  let orderShippingAddress = shippingAddress;
  if (!orderShippingAddress) {
    orderShippingAddress = {
      input: {
        fullName: 'Martinho Pinelabio',
        streetLine1: 'Verzetsstraat',
        streetLine2: '12a',
        city: 'Liwwa',
        postalCode: '8923CP',
        countryCode: 'NL',
      },
    };
  }
  const res = await proceedToArrangingPayment(
    shopClient,
    shippingMethodId,
    orderShippingAddress,
    billingAddress
  );
  if ((res as ErrorResult)?.errorCode) {
    console.error(JSON.stringify(res));
    throw Error((res as ErrorResult).errorCode);
  }
  return await addPaymentToOrder(shopClient, testPaymentMethod.code);
}
