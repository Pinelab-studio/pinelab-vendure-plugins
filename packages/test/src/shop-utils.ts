import { SimpleGraphQLClient } from "@vendure/testing";
import {
  AddItemToOrder,
  AddPaymentToOrder,
  SetShippingAddress, SetShippingAddressMutationVariables,
  SetShippingMethod,
  TransitionToState
} from "./generated/shop-graphql";

/**
 * Proceed the active order of current shopClient to proceed to payment
 */
export async function proceedToArrangingPayment(
  shopClient: SimpleGraphQLClient,
  address?: SetShippingAddressMutationVariables
) {
  await shopClient.query(SetShippingAddress, address ?? {
    input: {
      fullName: "Martinho Pinelabio",
      streetLine1: "Verzetsstraat",
      streetLine2: "12a",
      city: "Liwwa",
      postalCode: "8923CP",
      countryCode: "NL"
    }
  });
  await shopClient.query(SetShippingMethod, {
    id: 3
  });
  await shopClient.query(TransitionToState, { state: "ArrangingPayment" });
}

/**
 * Add payment to active order by given code
 */
export async function addPaymentToOrder(
  shopClient: SimpleGraphQLClient,
  code: string
) {
  await shopClient.query(AddPaymentToOrder, {
    input: {
      method: code,
      metadata: {
        baz: "quux"
      }
    }
  });
}

/**
 * Add item to active order
 */
export async function addItem(
  shopClient: SimpleGraphQLClient,
  variantId: string,
  quantity: number
) {
  await shopClient.query(AddItemToOrder, {
    productVariantId: variantId,
    quantity
  });
}