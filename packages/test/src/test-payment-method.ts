import { LanguageCode, PaymentMethodHandler } from "@vendure/core";

export const testPaymentMethod = new PaymentMethodHandler({
  code: 'test-payment-method',
  description: [
    { languageCode: LanguageCode.en, value: 'Test Payment Method' },
  ],
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
