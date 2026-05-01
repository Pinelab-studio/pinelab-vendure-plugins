import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  ActiveOrderService,
  Ctx,
  Customer,
  ID,
  PaginatedList,
  Permission,
  RelationPaths,
  Relations,
  RequestContext,
} from '@vendure/core';
import { WalletAdjustment } from '../entities/wallet-adjustment.entity';
import { Wallet } from '../entities/wallet.entity';
import { WalletService } from '../services/wallet.service';
import {
  CustomerWalletsArgs,
  WalletAdjustmentsArgs,
} from './generated/graphql';

@Resolver()
export class CommonResolver {
  constructor(
    private readonly walletService: WalletService,
    private readonly activeOrderService: ActiveOrderService
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

  @ResolveField('adjustments')
  @Resolver('Wallet')
  async adjustments(
    @Ctx() ctx: RequestContext,
    @Args() args: WalletAdjustmentsArgs,
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

  /**
   * Look up a wallet by its code (e.g. a gift card code).
   *
   * - On the admin API, the caller must have the UpdateOrder permission.
   * - On the shop API, the caller must have an active order on the session
   *   (i.e. actually be in the process of placing an order). This prevents
   *   using this query as an oracle to brute-force wallet codes.
   * - Returns `null` for unknown codes (never throws) to avoid leaking whether
   *   a given code exists.
   */
  @Query()
  async walletByCode(
    @Ctx() ctx: RequestContext,
    @Args() args: { code: string },
    @Relations({ entity: Wallet }) relations: RelationPaths<Wallet>
  ) {
    if (ctx.apiType === 'admin') {
      if (!ctx.userHasPermissions([Permission.UpdateOrder])) {
        return null;
      }
    } else {
      const activeOrder = await this.activeOrderService.getOrderFromContext(
        ctx
      );
      if (!activeOrder) {
        return null;
      }
    }
    return await this.walletService.findByCode(ctx, args.code, relations);
  }
}
