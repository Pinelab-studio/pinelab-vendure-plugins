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
  CheckPaymentInput,
  CreditCardPaymentInput,
  PaymentInput,
  TokenPaymentMethodInput,
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
    metadata
  ): Promise<CreatePaymentResult> {
    const ccMetadata = metadata as PaymentInput;
    const client = new AcceptBlueClient(args.apiKey, args.pin);
    if (isCardPaymentInputMetadata(ccMetadata as any)) {
      const result = await service.payWithCreditCard(
        ctx,
        order,
        amount,
        client,
        ccMetadata as CreditCardPaymentInput
      );
      Logger.info(
        `Created payment with manual card credentials for order ${order.code}`,
        loggerCtx
      );
      return {
        amount,
        state: 'Settled',
        transactionId: result.chargeResult?.transaction?.id,
        metadata: result,
      };
    } else if (isCheckPaymentInputMetaData(ccMetadata as any)) {
      const result = await service.payWithCheck(
        ctx,
        order,
        amount,
        client,
        ccMetadata as CheckPaymentInput
      );
      Logger.info(
        `Created payment with manual card credentials for order ${order.code}`,
        loggerCtx
      );
      return {
        amount,
        state: 'Settled',
        transactionId: result.chargeResult?.transaction?.id,
        metadata: result,
      };
    } else if (isTokenizedCardPaymentMetadata(ccMetadata as any)) {
      const result = await service.payWithToken(
        ctx,
        order,
        amount,
        client,
        ccMetadata as TokenPaymentMethodInput
      );
      Logger.info(
        `Created payment with manual card credentials for order ${order.code}`,
        loggerCtx
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
        `You need to supply a 'paymentMethodId' or metadata with relevant fields`
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

export function isCardPaymentInputMetadata(ccMetadata: any) {
  return ccMetadata.card && ccMetadata.expiry_year && ccMetadata.expiry_month;
}

export function isCheckPaymentInputMetaData(ccMetadata: any) {
  return (
    ccMetadata.routing_number && ccMetadata.account_number && ccMetadata.name
  );
}

export function isTokenizedCardPaymentMetadata(ccMetadata: any) {
  return (
    ccMetadata.source &&
    ccMetadata.last4 &&
    ccMetadata.expiry_year &&
    ccMetadata.expiry_month
  );
}
