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
  CheckPaymentMethodInput,
  NoncePaymentMethodInput,
  SavedPaymentMethodInput,
} from '../types';
import {
  isCheckPaymentMethod,
  isNoncePaymentMethod,
  isSavedPaymentMethod,
} from '../util';
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
    if (
      !isNoncePaymentMethod(metadata as any) &&
      !isCheckPaymentMethod(metadata as any) &&
      !isSavedPaymentMethod(metadata as any)
    ) {
      throw new UserInputError(`You either need to provide nonce input, check input or a saved payment method ID.
        Check requires the fields: name, routing_number, account_number, account_type and sec_code.
        Nonce requires the fields: source, expiry_month, expiry_year and last4.
        Saved payment method requires the field paymentMethodId
      `);
    }
    const input = metadata as
      | CheckPaymentMethodInput
      | NoncePaymentMethodInput
      | SavedPaymentMethodInput;
    const client = new AcceptBlueClient(args.apiKey, args.pin);
    const result = await service.handlePaymentForOrder(
      ctx,
      order,
      amount,
      client,
      input
    );
    const chargeTransactionId = result.chargeResult?.transaction?.id;
    Logger.info(
      `Settled payment for order '${order.code}', for Accept Blue customer '${result.customerId}' and one time charge transaction '${chargeTransactionId}'`,
      loggerCtx
    );
    return {
      amount,
      state: 'Settled',
      transactionId: chargeTransactionId
        ? String(chargeTransactionId)
        : undefined,
      metadata: result,
    };
  },
  settlePayment(): SettlePaymentResult {
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
  },
});
