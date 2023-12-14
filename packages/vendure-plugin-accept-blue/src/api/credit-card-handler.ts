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
import { loggerCtx } from '../constants';
import { CreditCardPaymentMethodInput } from '../types';
import { AcceptBlueClient } from './accept-blue-client';
import { AcceptBlueService } from './accept-blue-service';

let service: AcceptBlueService;
export const acceptBlueCreditCardHandler = new PaymentMethodHandler({
  code: 'accept-blue-credit-card',
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
    const ccMetadata = metadata as CreditCardPaymentMethodInput;
    if (
      !ccMetadata.card ||
      !ccMetadata.expiry_year ||
      !ccMetadata.expiry_month
    ) {
      throw new UserInputError(
        `At least 'card', 'expiry_year' and 'expiry_month' must be provided as metadata`
      );
    }
    const client = new AcceptBlueClient(args.apiKey, args.pin);
    const result = await service.handleCardPayment(
      ctx,
      order,
      amount,
      client,
      ccMetadata
    );
    Logger.info(`Created payment for order ${order.code}`, loggerCtx);
    return {
      amount,
      state: 'Settled',
      transactionId: result.chargeResult?.transaction?.id,
      metadata: result,
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
    throw Error(`not implemented`);
    // TODO
    // Logger.info(
    //   `Refund of ${amount} created for payment ${payment.transactionId} for order ${order.id}`,
    //   loggerCtx
    // );
    // // Log order history
    // return {
    //   state: 'Settled',
    //   // metadata: refund,
    // };
  },
});
