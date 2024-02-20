import {
  CreatePaymentResult,
  CreateRefundResult,
  Injector,
  LanguageCode,
  Logger,
  PaymentMethodHandler,
  SettlePaymentResult,
} from '@vendure/core';
import { loggerCtx } from '../../constants';
import { StripeSubscriptionService } from '../stripe-subscription.service';
import { printMoney } from '../util';

let service: StripeSubscriptionService;
export const stripeSubscriptionHandler = new PaymentMethodHandler({
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
      label: [{ languageCode: LanguageCode.en, value: 'API key' }],
      ui: { component: 'password-form-input' },
    },
    publishableKey: {
      type: 'string',
      required: false,
      label: [{ languageCode: LanguageCode.en, value: 'Publishable key' }],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'For use in the storefront only.',
        },
      ],
    },
    webhookSecret: {
      type: 'string',
      required: false,
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'Webhook secret',
        },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value:
            'Secret to validate incoming webhooks. Get this from he created webhooks in your Stripe dashboard',
        },
      ],
      ui: { component: 'password-form-input' },
    },
  },

  init(injector: Injector) {
    service = injector.get(StripeSubscriptionService);
  },

  async createPayment(
    ctx,
    order,
    amount,
    _,
    metadata,
  ): Promise<CreatePaymentResult> {
    // Payment is already settled in Stripe by the time the webhook in stripe.controller.ts
    // adds the payment to the order
    if (ctx.apiType !== 'admin') {
      throw Error(`CreatePayment is not allowed for apiType '${ctx.apiType}'`);
    }
    return {
      amount: metadata.amount,
      state: 'Settled',
      transactionId: metadata.setupIntentId,
      metadata,
    };
  },
  settlePayment(): SettlePaymentResult {
    // Payments will be settled via webhook
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
    args,
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
      loggerCtx,
    );
    await service.logHistoryEntry(
      ctx,
      order.id,
      `Created refund of ${printMoney(amount)}`,
    );
    return {
      state: 'Settled',
      metadata: refund,
    };
  },
});
