import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ID,
  OrderService,
  PaymentService,
  Permission,
  Refund,
  RequestContext,
  Transaction,
} from '@vendure/core';
import {
  MutationAdjustBalanceForWalletArgs,
  MutationCreateWalletArgs,
  MutationRefundPaymentToStoreCreditArgs,
  Wallet,
  WalletAdjustment,
} from './generated/graphql';
import { WalletService } from '../services/wallet.service';

@Resolver()
export class AdminResolver {
  constructor(
    private walletService: WalletService,
    private paymentService: PaymentService
  ) {}

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateCustomer)
  createWallet(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationCreateWalletArgs
  ): Promise<Wallet> {
    return this.walletService.create(ctx, args.input);
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateCustomer)
  async adjustBalanceForWallet(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationAdjustBalanceForWalletArgs
  ): Promise<Wallet> {
    const [wallet] = await this.walletService.adjustBalanceForWallet(
      ctx,
      args.input.amount,
      args.input.walletId,
      args.input.description
    );
    return wallet;
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateOrder)
  async refundPaymentToStoreCredit(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationRefundPaymentToStoreCreditArgs
  ): Promise<WalletAdjustment> {
    const payment = await this.paymentService.findOneOrThrow(
      ctx,
      args.input.paymentId,
      ['order']
    );
    return this.walletService.refundToStoreCredit(ctx, {
      order: payment.order,
      payment: payment,
      amount: args.input.amount,
      walletId: args.input.walletId,
      shouldCreateRefundEntity: true,
      reason: args.input.reason,
    });
  }
}
