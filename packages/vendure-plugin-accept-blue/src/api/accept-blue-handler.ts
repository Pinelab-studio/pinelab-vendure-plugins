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
    },
    pin: {
      type: 'string',
      required: false,
      label: [{ languageCode: LanguageCode.en, value: 'PIN' }],
      ui: { component: 'password-form-input' },
    },
    webhookSecret: {
      type: 'string',
      required: false,
      label: [{ languageCode: LanguageCode.en, value: 'Webhook secret' }],
      description: [
        {
          languageCode: LanguageCode.en,
          value:
            'Automatically filled when webhooks are created on payment method creation or update.',
        },
      ],
    },
    testMode: {
      type: 'boolean',
      required: false,
      defaultValue: false,
      label: [{ languageCode: LanguageCode.en, value: 'Use test mode' }],
      ui: { component: 'boolean-form-input' },
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      !isNoncePaymentMethod(metadata as any) &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      !isCheckPaymentMethod(metadata as any) &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
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
    const client = new AcceptBlueClient(args.apiKey, args.pin, args.testMode);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    const result = await service.handlePaymentForOrder(
      ctx,
      order,
      amount,
      client,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

  createRefund(): Promise<CreateRefundResult> {
    throw Error(`not implemented`);
  },
});
