import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  RequestContext,
  Customer,
  RelationPaths,
  Relations,
  PaginatedList,
  ID,
} from '@vendure/core';
import { Wallet } from '../entities/wallet.entity';
import {
  CustomerWalletsArgs,
  WalletAdjustmentListArgs,
} from './generated/graphql';
import { WalletService } from '../services/wallet.service';
import { WalletAdjustment } from '../entities/wallet-adjustment.entity';

@Resolver()
export class CommonResolver {
  constructor(private readonly walletService: WalletService) {}

  @ResolveField('wallets')
  @Resolver('Customer')
  wallets(
    @Ctx() ctx: RequestContext,
    @Args() args: CustomerWalletsArgs,
    @Relations({ entity: Wallet }) relations: RelationPaths<Wallet>,
    @Parent() customer: Customer
  ): Promise<PaginatedList<Wallet>> {
    return this.walletService.findAll(
      ctx,
      customer.id,
      args.options || undefined,
      relations
    );
  }

  @ResolveField('adjustmentList')
  @Resolver('Wallet')
  async adjustmentList(
    @Ctx() ctx: RequestContext,
    @Args() args: WalletAdjustmentListArgs,
    @Relations({ entity: WalletAdjustment })
    relations: RelationPaths<WalletAdjustment>,
    @Parent() wallet: Wallet
  ): Promise<PaginatedList<WalletAdjustment>> {
    return this.walletService.findAdjustmentsForWallet(
      ctx,
      wallet.id,
      args.options || undefined,
      relations
    );
  }

  @Query()
  async wallet(
    @Ctx() ctx: RequestContext,
    @Args() args: { id: ID },
    @Relations({ entity: Wallet }) relations: RelationPaths<Wallet>
  ) {
    return this.walletService.findOne(ctx, args.id, relations);
  }
}
