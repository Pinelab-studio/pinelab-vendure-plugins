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
} from './generated/graphql';
import { WalletService } from '../services/wallet.service';

@Resolver()
export class AdminResolver {
  constructor(private walletService: WalletService) {}

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
    @Args() args: { paymentId: ID; walletId: ID }
  ) {
    return this.walletService.refundPaymentToStoreCredit(
      ctx,
      args.paymentId,
      args.walletId
    );
  }
}
