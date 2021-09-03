import { ID } from '@vendure/common/lib/shared-types';
import { LanguageCode, PaymentMethodHandler } from "@vendure/core";
import { SimpleGraphQLClient } from '@vendure/testing';
import { ADD_PAYMENT, SET_SHIPPING_ADDRESS, SET_SHIPPING_METHOD, TRANSITION_TO_STATE } from "./queries";

export async function proceedToArrangingPayment(shopClient: SimpleGraphQLClient) {
    await shopClient.query(SET_SHIPPING_ADDRESS, {
        input: {
            fullName: 'name',
            streetLine1: '12 the street',
            city: 'foo',
            postalCode: '123456',
            countryCode: 'US',
        },
    });
    await shopClient.query(SET_SHIPPING_METHOD, {
        id: 3,
    });
    await shopClient.query(TRANSITION_TO_STATE, { state: 'ArrangingPayment' });
}

export async function addPaymentToOrder(
    shopClient: SimpleGraphQLClient,
    handler: PaymentMethodHandler,
) {
    await shopClient.query(
        ADD_PAYMENT,
        {
            input: {
                method: handler.code,
                metadata: {
                    baz: 'quux',
                },
            },
        },
    );
}

export const testSuccessfulPaymentMethod = new PaymentMethodHandler({
    code: 'test-payment-method',
    description: [{ languageCode: LanguageCode.en, value: 'Test Payment Method' }],
    args: {},
    createPayment: (ctx, order, amount, args, metadata) => {
        return {
            amount,
            state: 'Settled',
            transactionId: '12345',
            metadata: { public: metadata },
        };
    },
    settlePayment: () => ({
        success: true,
    }),
});

