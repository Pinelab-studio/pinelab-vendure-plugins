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
import {
  CreditCardPaymentInput,
  SavedMethodInput as SavedPaymentMethodInput,
} from '../types';
import { AcceptBlueClient } from './accept-blue-client';
import { AcceptBlueService } from './accept-blue-service';

let service: AcceptBlueService;
export const acceptBluePaymentHandler = new PaymentMethodHandler({
  code: 'accept-blue-payment',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Accept Blue',
    },
  ],
  args: {
    apiKey: {
      type: 'string',
      required: true,
      label: [{ languageCode: LanguageCode.en, value: 'API key' }],
      ui: { component: 'password-form-input' },
    },
    tokenizationSourceKey: {
      type: 'string',
      required: false,
      label: [
        { languageCode: LanguageCode.en, value: 'Hosted tokenization key' },
      ],
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
    metadata,
  ): Promise<CreatePaymentResult> {
    const ccMetadata = metadata as CreditCardPaymentInput;
    const client = new AcceptBlueClient(args.apiKey, args.pin);
    if ((metadata as SavedPaymentMethodInput).paymentMethodId) {
      const { paymentMethodId } = metadata as SavedPaymentMethodInput;
      const result = await service.payWithSavedPaymentMethod(
        ctx,
        order,
        amount,
        client,
        paymentMethodId,
      );
      Logger.info(
        `Created payment for saved payment method '${paymentMethodId}' for order ${order.code}`,
        loggerCtx,
      );
      return {
        amount,
        state: 'Settled',
        transactionId: result.chargeResult?.transaction?.id,
        metadata: result,
      };
    } else if (
      ccMetadata.card &&
      ccMetadata.expiry_year &&
      ccMetadata.expiry_month
    ) {
      const result = await service.payWithCreditCard(
        ctx,
        order,
        amount,
        client,
        ccMetadata,
      );
      Logger.info(
        `Created payment with manual card credentials for order ${order.code}`,
        loggerCtx,
      );
      return {
        amount,
        state: 'Settled',
        transactionId: result.chargeResult?.transaction?.id,
        metadata: result,
      };
    } else {
      // Invalid input
      throw new UserInputError(
        `You need to supply a 'paymentMethodId', or 'card', 'expiry_year' and 'expiry_month' as metadata`,
      );
    }
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
    args,
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
