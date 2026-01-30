import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  RequestContext,
  Customer,
  RelationPaths,
  Relations,
  PaginatedList,
  Translated,
  EntityHydrator,
  ChannelService,
  idsAreEqual,
  LocaleStringHydrator,
  ID,
} from '@vendure/core';
import { Wallet } from '../entities/wallet.entity';
import { WalletListOptions } from './generated/graphql';
import { WalletService } from '../services/wallet.service';

@Resolver()
export class CommonResolver {
  constructor(
    private readonly walletService: WalletService,
    private channelService: ChannelService,
    private localeStringHydrator: LocaleStringHydrator,
    private entityHydrator: EntityHydrator
  ) {}

  @ResolveField('wallets')
  @Resolver('Customer')
  wallets(
    @Ctx() ctx: RequestContext,
    @Args() args: { options: WalletListOptions },
    @Relations({ entity: Wallet }) relations: RelationPaths<Wallet>,
    @Parent() customer: Customer
  ): Promise<PaginatedList<Translated<Wallet>>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.walletService.findAll(
      ctx,
      customer.id,
      args.options || undefined,
      relations
    );
  }

  @ResolveField('currencyCode')
  @Resolver('Wallet')
  async currencyCode(@Ctx() ctx: RequestContext, @Parent() wallet: Wallet) {
    await this.entityHydrator.hydrate(ctx, wallet, { relations: ['channels'] });
    const defaultChannel = await this.channelService.getDefaultChannel(ctx);
    const nonDefaultChannel = wallet.channels.find(
      (channel) => !idsAreEqual(channel.id, defaultChannel.id)
    );
    if (nonDefaultChannel) {
      return nonDefaultChannel?.defaultCurrencyCode;
    }
    return defaultChannel.defaultCurrencyCode;
  }

  @ResolveField('name')
  @Resolver('Wallet')
  async name(
    @Ctx() ctx: RequestContext,
    @Parent() wallet: Wallet
  ): Promise<string> {
    return this.localeStringHydrator.hydrateLocaleStringField(
      ctx,
      wallet,
      'name'
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
