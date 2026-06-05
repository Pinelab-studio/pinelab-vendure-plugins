'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.testPaymentMethod = void 0;
const core_1 = require('@vendure/core');
exports.testPaymentMethod = new core_1.PaymentMethodHandler({
  code: 'test-payment-method',
  description: [
    { languageCode: core_1.LanguageCode.en, value: 'Test Payment Method' },
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
