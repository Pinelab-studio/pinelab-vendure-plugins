import {
  CreatePaymentResult,
  CreateRefundResult,
  Injector,
  LanguageCode,
  Logger,
  PaymentMethodHandler,
  SettlePaymentResult,
} from '@vendure/core';
import { loggerCtx } from '../constants';
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
    await service.createCharge(ctx);
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
    // TODO
    Logger.info(
      `Refund of ${amount} created for payment ${payment.transactionId} for order ${order.id}`,
      loggerCtx
    );
    // Log order history
    return {
      state: 'Settled',
      // metadata: refund,
    };
  },
});
