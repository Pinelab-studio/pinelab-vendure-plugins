import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';

/**
 * Marks an order as placed, without any payment needed. This is used for purchase orders, where customers need to be in a specific group.
 */
export const settleWithoutPaymentHandler = new PaymentMethodHandler({
  code: 'settle-without-payment-handler',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Settle Without Payment Handler',
    },
  ],
  args: {},
  createPayment: (ctx, order, amount, args, metadata) => {
    Logger.info(
      `'${order.code}' settled without an upfront pay for customer '${order.customer?.emailAddress}'`
    );
    return {
      amount,
      state: 'Settled',
      metadata: { note: 'Settled without payment' },
    };
  },
  settlePayment: () => ({
    success: true,
  }),
});
