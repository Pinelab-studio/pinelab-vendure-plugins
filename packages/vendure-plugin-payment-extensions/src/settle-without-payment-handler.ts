import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';

/**
 * Marks an order as placed, without any payment needed. This is used for purchase orders, where customers need to be in a specific group.
 */
export const settleWithoutPaymentHandler = new PaymentMethodHandler({
  code: 'settle-order-without-payment',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Settle order without payment',
    },
  ],
  args: {},
  createPayment: (_, order, amount, __, metadata) => {
    Logger.info(
      `'${order.code}' settled without payment for customer '${order.customer?.emailAddress}'`
    );
    return {
      amount,
      state: 'Settled',
      metadata: { ...metadata, note: 'Settled without payment' },
    };
  },
  settlePayment: () => ({
    success: true,
  }),
});
