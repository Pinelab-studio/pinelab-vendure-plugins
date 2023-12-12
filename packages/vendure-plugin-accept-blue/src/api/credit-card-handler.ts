import {
  CreatePaymentResult,
  CreateRefundResult,
  Injector,
  LanguageCode,
  Logger,
  PaymentMethodHandler,
  SettlePaymentResult,
} from '@vendure/core';
import { AcceptBlueClient } from './accept-blue-client';
import { AcceptBlueService } from './accept-blue-service';

let service: AcceptBlueService;
export const acceptBlueCreditCardHandler = new PaymentMethodHandler({
  code: 'stripe-subscription',

  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Stripe Subscription',
    },
  ],

  args: {
    apiKey: {
      type: 'string',
      required: true,
      label: [{ languageCode: LanguageCode.en, value: 'API key' }],
      ui: { component: 'password-form-input' },
    },
    pin: {
      type: 'string',
      required: false,
      label: [{ languageCode: LanguageCode.en, value: 'PIN' }],
      ui: { component: 'password-form-input' },
    },
  },

  init(injector: Injector) {
    service = injector.get(AcceptBlueService);
  },

  async createPayment(
    ctx,
    order,
    amount,
    args,
    metadata
  ): Promise<CreatePaymentResult> {
    if (amount > 0) {
      throw Error(`The plugin doesn't support one-time charges yet`);
    }
    // Create recurring schedules for order
    return {
      amount: metadata.amount,
      state: 'Authorized',
      transactionId: metadata.setupIntentId,
      metadata,
    };
  },
  settlePayment(): SettlePaymentResult {
    // TODO capture payment
    return {
      success: true,
    };
  },

  async createRefund(
    ctx,
    input,
    amount,
    order,
    payment,
    args
  ): Promise<CreateRefundResult> {
    const { stripeClient } = await service.getStripeContext(ctx);
    const refund = await stripeClient.refunds.create({
      payment_intent: payment.transactionId,
      amount,
    });
    Logger.info(
      `Refund of ${printMoney(amount)} created for payment ${
        payment.transactionId
      } for order ${order.id}`,
      loggerCtx
    );
    await service.logHistoryEntry(
      ctx,
      order.id,
      `Created refund of ${printMoney(amount)}`
    );
    return {
      state: 'Settled',
      metadata: refund,
    };
  },
});
