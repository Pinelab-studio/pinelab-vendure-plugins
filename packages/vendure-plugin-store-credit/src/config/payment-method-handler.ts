import {
  PaymentMethodHandler,
  CreatePaymentResult,
  SettlePaymentResult,
  LanguageCode,
} from '@vendure/core';
import { WalletService } from '../services/wallet.service';
import { asError } from 'catch-unknown';

let walletService: WalletService;

export const storeCreditPaymentHandler = new PaymentMethodHandler({
  code: 'store-credit-payment-provider',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Store Credit Payment Provider',
    },
  ],
  args: {},
  init: (injector) => {
    walletService = injector.get(WalletService);
  },
  createPayment: async (
    ctx,
    order,
    amount,
    args,
    metadata
  ): Promise<CreatePaymentResult> => {
    if (!metadata.walletId) {
      throw new Error('Wallet ID is required as input metadata');
    }
    try {
      await walletService.payWithStoreCredit(
        ctx,
        order,
        amount,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        metadata.walletId
      );
      return {
        amount,
        state: 'Settled',
        metadata,
      };
    } catch (err) {
      return {
        amount,
        state: 'Declined' as const,
        errorMessage: asError(err).message,
        metadata,
      };
    }
  },
  settlePayment: (): SettlePaymentResult => {
    // Create payment already settles the payment, so we don't need to do anything here
    return { success: true };
  },
  createRefund: async (ctx, input, amount, order, payment) => {
    if (!payment.metadata.walletId) {
      throw new Error('Wallet ID is required as input metadata');
    }
    try {
      await walletService.refundPaymentToStoreCredit(
        ctx,
        payment.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        payment.metadata.walletId
      );
      return {
        state: 'Settled',
      };
    } catch (err: any) {
      return {
        state: 'Failed',
        errorMessage: asError(err).message,
        metadata: {
          errorMessage: asError(err).message,
        },
      };
    }
  },
  cancelPayment: () => {
    return {
      success: true,
      metadata: {
        cancellationDate: new Date().toISOString(),
      },
    };
  },
});
