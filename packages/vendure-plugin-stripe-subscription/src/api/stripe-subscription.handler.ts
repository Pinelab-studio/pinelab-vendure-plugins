import {
  CreatePaymentResult,
  CreateRefundResult,
  Injector,
  LanguageCode,
  Logger,
  PaymentMethodHandler,
  SettlePaymentResult,
  UserInputError,
} from '@vendure/core';
import { RequestContext } from '@vendure/core/dist/api/common/request-context';
import { Order, Payment, PaymentMethod } from '@vendure/core/dist/entity';
import {
  CancelPaymentErrorResult,
  CancelPaymentResult,
} from '@vendure/core/dist/config/payment/payment-method-handler';
import {
  OrderLineWithSubscriptionFields,
  OrderWithSubscriptionFields,
} from './subscription-custom-fields';
import { StripeSubscriptionService } from './stripe-subscription.service';
import { StripeClient } from './stripe.client';
import { loggerCtx } from '../constants';
import { printMoney } from './pricing.helper';

let service: StripeSubscriptionService;
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
      ui: { component: 'password-form-input' },
    },
    publishableKey: {
      type: 'string',
      required: false,
      label: [
        { languageCode: LanguageCode.en, value: 'Stripe publishable key' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value:
            'You can retrieve this via the "eligiblePaymentMethods.stripeSubscriptionPublishableKey" query in the shop api',
        },
      ],
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
    args
  ): Promise<CreateRefundResult> {
    const { stripeClient } = await service.getStripeHandler(ctx, order.id);
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
