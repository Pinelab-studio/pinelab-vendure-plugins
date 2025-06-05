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
  AppleOrGooglePayInput,
  NoncePaymentMethodInput,
  SavedPaymentMethodInput,
} from '../types';
import {
  isCheckPaymentMethod,
  isGooglePayPaymentMethod as isAppleOrGooglePay,
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
    allowGooglePay: {
      type: 'boolean',
      required: false,
      defaultValue: true,
      label: [{ languageCode: LanguageCode.en, value: 'Google Pay' }],
    },
    allowApplePay: {
      type: 'boolean',
      required: false,
      defaultValue: true,
      label: [{ languageCode: LanguageCode.en, value: 'Apple Pay' }],
    },
    tokenizationSourceKey: {
      type: 'string',
      required: false,
      label: [
        { languageCode: LanguageCode.en, value: 'Hosted tokenization key' },
      ],
    },
    googlePayMerchantId: {
      type: 'string',
      required: false,
      label: [
        { languageCode: LanguageCode.en, value: 'Google Pay Merchant Id' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'The Merchant Id as defined in your Google Payment Profile',
        },
      ],
    },
    googlePayGatewayMerchantId: {
      type: 'string',
      required: false,
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'Google Pay Gateway Merchant Id',
        },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Can be found in your Accept Blue Control Panel',
        },
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
      !isNoncePaymentMethod(metadata as NoncePaymentMethodInput) &&
      !isCheckPaymentMethod(metadata as CheckPaymentMethodInput) &&
      !isAppleOrGooglePay(metadata as AppleOrGooglePayInput) &&
      !isSavedPaymentMethod(metadata as SavedPaymentMethodInput)
    ) {
      throw new UserInputError(
        `You either need to provide Nonce, Check or GooglePay input, or a saved payment method ID`
      );
    }
    const input = metadata as
      | CheckPaymentMethodInput
      | NoncePaymentMethodInput
      | SavedPaymentMethodInput
      | AppleOrGooglePayInput;
    const client = new AcceptBlueClient(
      args.apiKey,
      args.pin,
      args,
      args.testMode
    );
    try {
      if (isAppleOrGooglePay(input as AppleOrGooglePayInput)) {
        return await service.handleAppleOrGooglePayment(
          ctx,
          order,
          amount,
          client,
          input as AppleOrGooglePayInput
        );
      } else {
        return await service.handleTraditionalPaymentForOrder(
          ctx,
          order,
          amount,
          client,
          input as NoncePaymentMethodInput | CheckPaymentMethodInput
        );
      }
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
