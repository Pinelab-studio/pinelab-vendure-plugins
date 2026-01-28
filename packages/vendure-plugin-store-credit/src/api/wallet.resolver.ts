import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction } from '@vendure/core';
import {
  AdjustBalanceForWalletInput,
  CreateWalletInput,
} from './generated/graphql';
import { WalletService } from '../services/wallet.service';

@Resolver()
export class WalletResolver {
  constructor(private walletService: WalletService) {}

  @Transaction()
  @Mutation()
  createWallet(@Ctx() ctx: RequestContext, @Args() args: CreateWalletInput) {
    return this.walletService.createWallet(ctx, args);
  }

  @Transaction()
  @Mutation()
  adjustBalanceForWallet(
    @Ctx() ctx: RequestContext,
    @Args() args: AdjustBalanceForWalletInput
  ) {
    return this.walletService.adjustBalanceForWallet(ctx, args);
  }
}
