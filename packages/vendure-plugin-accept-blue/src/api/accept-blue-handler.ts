import { RefundOrderInput } from '@vendure/common/lib/generated-types';
import {
  CreatePaymentResult,
  CreateRefundResult,
  Injector,
  LanguageCode,
  Logger,
  Order,
  Payment,
  PaymentMethodHandler,
  RequestContext,
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
import { asError } from 'catch-unknown';

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
    pin: {
      type: 'string',
      required: false,
      label: [{ languageCode: LanguageCode.en, value: 'PIN' }],
      ui: { component: 'password-form-input' },
    },
    allowVisa: {
      type: 'boolean',
      required: false,
      defaultValue: true,
      label: [{ languageCode: LanguageCode.en, value: 'Visa' }],
    },
    allowMasterCard: {
      type: 'boolean',
      required: false,
      defaultValue: true,
      label: [{ languageCode: LanguageCode.en, value: 'Master Card' }],
    },
    allowAmex: {
      type: 'boolean',
      required: false,
      defaultValue: true,
      label: [{ languageCode: LanguageCode.en, value: 'Amex' }],
    },
    allowDiscover: {
      type: 'boolean',
      required: false,
      defaultValue: true,
      label: [{ languageCode: LanguageCode.en, value: 'Discover' }],
    },
    allowECheck: {
      type: 'boolean',
      required: false,
      defaultValue: true,
      label: [{ languageCode: LanguageCode.en, value: 'E-check' }],
    },
    tokenizationSourceKey: {
      type: 'string',
      required: false,
      label: [
        { languageCode: LanguageCode.en, value: 'Hosted tokenization key' },
      ],
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
    const client = new AcceptBlueClient(
      args.apiKey,
      args.pin,
      args,
      args.testMode
    );
    try {
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
    } catch (e) {
      const error = asError(e);
      Logger.error(
        `Error settling payment for order '${order.code}': ${error.message}`,
        loggerCtx,
        error.stack
      );
      return {
        amount,
        state: 'Declined',
        errorMessage: error.message,
      };
    }
  },
  settlePayment(): SettlePaymentResult {
    return {
      success: true,
    };
  },

  async createRefund(
    ctx: RequestContext,
    input: RefundOrderInput,
    amount: number,
    order: Order,
    payment: Payment
  ): Promise<CreateRefundResult> {
    const transactionId = Number(payment.transactionId); // All AC transactions are numbers
    const refundResult = await service.refund(ctx, transactionId, input.amount);
    if (refundResult.errorCode) {
      return {
        state: 'Failed',
        transactionId: String(refundResult.referenceNumber),
        metadata: refundResult,
      };
    }
    return {
      state: 'Settled',
      transactionId: String(refundResult.referenceNumber),
      metadata: refundResult,
    };
  },
});
