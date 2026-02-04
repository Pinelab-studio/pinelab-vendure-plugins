import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ID,
  Permission,
  RequestContext,
  Transaction,
} from '@vendure/core';
import {
  MutationAdjustBalanceForWalletArgs,
  MutationCreateWalletArgs,
  MutationRefundPaymentToStoreCreditArgs,
} from './generated/graphql';
import { WalletService } from '../services/wallet.service';
import { RefundStoreCreditService } from '../services/refund-store-credit.service';

@Resolver()
export class AdminResolver {
  constructor(
    private walletService: WalletService,
    private refundStoreCreditService: RefundStoreCreditService
  ) {}

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateCustomer)
  createWallet(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationCreateWalletArgs
  ) {
    return this.walletService.create(ctx, args.input);
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateCustomer)
  adjustBalanceForWallet(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationAdjustBalanceForWalletArgs
  ) {
    return this.walletService.adjustBalanceForWallet(
      ctx,
      args.input.amount,
      args.input.walletId,
      args.input.description
    );
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateOrder)
  refundPaymentToStoreCredit(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationRefundPaymentToStoreCreditArgs
  ) {
    return this.refundStoreCreditService.refundOrder(
      ctx,
      args.input.paymentId,
      args.input.amount,
      args.input.reason
    );
  }
}
