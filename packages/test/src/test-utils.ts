import { defaultShippingCalculator, defaultShippingEligibilityChecker, LanguageCode } from "@vendure/core";
import { Fulfillment } from '@vendure/common/lib/generated-types';
import { SimpleGraphQLClient } from "@vendure/testing";
import {
  ADD_ITEM_TO_ORDER,
  ADD_PAYMENT,
  CREATE_SHIPPING_METHOD,
  FULFILL,
  SET_SHIPPING_ADDRESS,
  SET_SHIPPING_METHOD,
  TRANSITION_TO_STATE
} from "./queries";

/**
 * Proceed the active order of current shopClient to proceed to payment
 */
export async function proceedToArrangingPayment(
  shopClient: SimpleGraphQLClient
) {
  await shopClient.query(SET_SHIPPING_ADDRESS, {
    input: {
      fullName: "Martinho Pinelabio",
      streetLine1: "Verzetsstraat",
      streetLine2: "12a",
      city: "Liwwa",
      postalCode: "8923CP",
      countryCode: "NL"
    }
  });
  await shopClient.query(SET_SHIPPING_METHOD, {
    id: 3
  });
  await shopClient.query(TRANSITION_TO_STATE, { state: "ArrangingPayment" });
}

/**
 * Add payment to active order by given code
 */
export async function addPaymentToOrder(
  shopClient: SimpleGraphQLClient,
  code: string
) {
  await shopClient.query(ADD_PAYMENT, {
    input: {
      method: code,
      metadata: {
        baz: "quux"
      }
    }
  });
}

/**
 *
 * @param adminClient
 */
export async function addShippingMethod(adminClient: SimpleGraphQLClient, fulfillmentHandlerCode: string) {
  await adminClient.asSuperAdmin();
  await adminClient.query(CREATE_SHIPPING_METHOD, {
    input: {
      code: "test-shipping-method",
      fulfillmentHandler: fulfillmentHandlerCode,
      checker: {
        code: defaultShippingEligibilityChecker.code,
        arguments: [
          {
            name: "orderMinimum",
            value: "0"
          }
        ]
      },
      calculator: {
        code: defaultShippingCalculator.code,
        arguments: [
          {
            name: "rate",
            value: "500"
          },
          {
            name: "taxRate",
            value: "0"
          }
        ]
      },
      translations: [
        { languageCode: LanguageCode.en, name: "test method", description: "" }
      ]
    }
  });
}

/**
 * Add item to active order
 */
export async function addItem(shopClient: SimpleGraphQLClient, variantId: string, quantity: number) {
  await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: variantId,
    quantity
  });
}

export async function fulfill(adminClient: SimpleGraphQLClient, handlerCode: string, items: [variantId: string, quantity: number][]): Promise<Fulfillment> {
  const lines = items.map(item => ({orderLineId: item[0], quantity: item[1]}))
  const {data: {addFulfillmentToOrder}} = await adminClient.query(FULFILL, {
    input: {
      lines,
      handler: {
        code: handlerCode,
        arguments: []
      }
    }
  });
  return addFulfillmentToOrder
}