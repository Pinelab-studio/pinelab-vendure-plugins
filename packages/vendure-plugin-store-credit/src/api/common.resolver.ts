import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  RequestContext,
  Customer,
  RelationPaths,
  Relations,
  PaginatedList,
  EntityHydrator,
  ChannelService,
  idsAreEqual,
  ID,
} from '@vendure/core';
import { Wallet } from '../entities/wallet.entity';
import { CustomerWalletsArgs, WalletListOptions } from './generated/graphql';
import { WalletService } from '../services/wallet.service';

@Resolver()
export class CommonResolver {
  constructor(
    private readonly walletService: WalletService,
    private channelService: ChannelService,
    private entityHydrator: EntityHydrator
  ) {}

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

  @Query()
  async wallet(
    @Ctx() ctx: RequestContext,
    @Args() args: { id: ID },
    @Relations({ entity: Wallet }) relations: RelationPaths<Wallet>
  ) {
    return this.walletService.findOne(ctx, args.id, relations);
  }
}
