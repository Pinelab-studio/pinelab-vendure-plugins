import {
  CreatePaymentResult,
  CreateRefundResult,
  Injector,
  LanguageCode,
  PaymentMethodHandler,
  SettlePaymentResult,
} from '@vendure/core';
import { RequestContext } from '@vendure/core/dist/api/common/request-context';
import { Order, Payment, PaymentMethod } from '@vendure/core/dist/entity';
import {
  CancelPaymentErrorResult,
  CancelPaymentResult,
} from '@vendure/core/dist/config/payment/payment-method-handler';

export const stripeSubscriptionHandler = new PaymentMethodHandler({
  code: 'stripe-subscription',

  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Use a Stripe Subscription as payment',
    },
  ],

  args: {
    apiKey: {
      type: 'string',
      label: [{ languageCode: LanguageCode.en, value: 'Stripe API key' }],
    },
    webhookSecret: {
      type: 'string',
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
            'Secret to validate incoming webhooks. Get this from your Stripe dashboard',
        },
      ],
    },
  },

  init(injector: Injector) {},

  async createPayment(
    ctx,
    order,
    amount,
    _,
    metadata
  ): Promise<CreatePaymentResult> {
    // Payment is already settled in Stripe by the time the webhook in stripe.controller.ts
    // adds the payment to the order
    if (ctx.apiType !== 'admin') {
      throw Error(`CreatePayment is not allowed for apiType '${ctx.apiType}'`);
    }
    return {
      amount: metadata.amount,
      state: 'Settled',
      transactionId: metadata.subscriptionId,
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
    args
  ): Promise<CreateRefundResult> {
    console.log();
    throw Error(`Stripe subscriptions can not be refunded via Vendure`);
  },
});
