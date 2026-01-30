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
  createPayment: async (
    ctx,
    order,
    amount,
    args,
    metadata
  ): Promise<CreatePaymentResult> => {
    console.log('createPayment', ctx, order, amount, args, metadata);
    await walletService.adjustBalanceForWallet(ctx, -amount, metadata.walletId);
    return {
      amount,
      state: 'Settled',
      metadata,
    };
  },
  settlePayment: (): SettlePaymentResult => {
    // Create payment already settles the payment, so we don't need to do anything here
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
