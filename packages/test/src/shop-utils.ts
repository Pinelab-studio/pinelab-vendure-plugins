import { SimpleGraphQLClient } from '@vendure/testing';
import {
  AddItemToOrder,
  AddPaymentToOrder,
  AddPaymentToOrderMutation,
  SetShippingAddress,
  SetShippingAddressMutationVariables,
  SetShippingMethod,
  TransitionToState,
} from './generated/shop-graphql';
import { Order } from '@vendure/core';

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
  await shopClient.query(TransitionToState, { state: 'ArrangingPayment' });
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
