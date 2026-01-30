import {
  PaymentMethodHandler,
  CreatePaymentResult,
  SettlePaymentResult,
  LanguageCode,
} from '@vendure/core';
import { WalletService } from '../services/wallet.service';

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
  createPayment: (ctx, order, amount, args, metadata): CreatePaymentResult => {
    return {
      amount,
      state: 'Settled',
      metadata,
    };
  },
  settlePayment: (): SettlePaymentResult => {
    return { success: true };
  },
  createRefund: async (ctx, input, amount, order, payment) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await walletService.refundPaymentToStoreCredit(
        ctx,
        payment.id,
        payment.metadata.walletId
      );
      return {
        state: 'Settled',
      };
    } catch (err) {
      return {
        state: 'Failed',
        metadata: {
          err,
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
