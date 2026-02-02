import { Injectable } from '@nestjs/common';
import { unique } from '@vendure/common/lib/unique';
import {
  assertFound,
  ChannelService,
  ID,
  idsAreEqual,
  ListQueryBuilder,
  ListQueryOptions,
  Logger,
  Order,
  PaginatedList,
  PaymentService,
  RelationPaths,
  RequestContext,
  TransactionalConnection,
  User,
  UserInputError,
  UserService,
} from '@vendure/core';
import { CreateWalletInput } from '../api/generated/graphql';
import { WalletAdjustment } from '../entities/wallet-adjustment.entity';
import { Wallet } from '../entities/wallet.entity';

@Injectable()
export class WalletService {
  private readonly relations = [
    'channels',
    'customer',
    'adjustments.mutatedBy',
  ];
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly channelService: ChannelService,
    private readonly listQueryBuilder: ListQueryBuilder,
    private readonly paymentService: PaymentService,
    private readonly userService: UserService
  ) {}

  findAll(
    ctx: RequestContext,
    customerId: ID,
    options?: ListQueryOptions<Wallet>,
    relations: RelationPaths<Wallet> = []
  ): Promise<PaginatedList<Wallet>> {
    return this.listQueryBuilder
      .build(Wallet, options, {
        relations: relations ?? this.relations,
        channelId: ctx.channelId,
        ctx,
        where: { customer: { id: customerId } },
      })
      .getManyAndCount()
      .then(([items, totalItems]) => {
        return {
          items,
          totalItems,
        };
      });
  }

  async create(ctx: RequestContext, input: CreateWalletInput): Promise<Wallet> {
    const wallet = new Wallet({
      name: input.name as string,
      customer: { id: input.customerId },
      balance: 0,
      currencyCode: ctx.channel.defaultCurrencyCode,
    });
    const savedWallet = await this.connection
      .getRepository(ctx, Wallet)
      .save(wallet);
    const defaultChannel = await this.channelService.getDefaultChannel();
    await this.channelService.assignToChannels(
      ctx,
      Wallet,
      wallet.id,
      unique([defaultChannel.id, input.channelId]) as string[]
    );
    return assertFound(this.findOne(ctx, savedWallet.id));
  }

  async adjustBalanceForWallet(
    ctx: RequestContext,
    amount: number,
    walletId: ID,
    description: string,
    user: User | undefined
  ): Promise<Wallet> {
    const walletRepo = this.connection.getRepository(ctx, Wallet);
    const adjustmentRepo = this.connection.getRepository(ctx, WalletAdjustment);

    const wallet = await walletRepo.findOneOrFail({
      where: { id: walletId },
      relations: ['channels'],
    });
    const isAllowedInChannel = wallet.channels.some((channel) =>
      idsAreEqual(channel.id, ctx.channelId)
    );

    if (!isAllowedInChannel) {
      throw new UserInputError(
        `Wallet with id ${walletId} is not active in the current Channel`
      );
    }
    // TODO: For debit, check if the amount is less than the existing balance
    const res = await walletRepo
      .createQueryBuilder()
      .update(Wallet)
      .set({ balance: () => `balance + :amount` })
      .where('id = :id', { id: walletId })
      .setParameters({ amount })
      .execute();

    if ((res.affected ?? 0) !== 1) {
      Logger.warn(
        `Wallet balance update did not affect exactly one row: ${JSON.stringify(
          {
            walletId,
            affected: res.affected,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            raw: res.raw,
          }
        )}`
      );
    }

    await adjustmentRepo.save(
      adjustmentRepo.create({
        wallet: { id: walletId } as Wallet,
        amount,
        description,
        mutatedBy: user,
      })
    );

    return assertFound(this.findOne(ctx, walletId));
  }

  async refundPaymentToStoreCredit(
    ctx: RequestContext,
    paymentId: ID,
    walletId: ID
  ) {
    let adminUser: User | undefined;
    if (ctx.activeUserId) {
      adminUser = await this.userService.getUserById(ctx, ctx.activeUserId);
    }
    const payment = await this.paymentService.findOneOrThrow(ctx, paymentId, [
      'order',
    ]);
    const description = `refunded for order ${payment.order.code}`;
    return this.adjustBalanceForWallet(
      ctx,
      -1 * payment.amount,
      walletId,
      description,
      adminUser
    );
  }

  async adminAdjustBalance(
    ctx: RequestContext,
    amount: number,
    walletId: ID,
    description: string
  ) {
    let adminUser: User | undefined;
    if (ctx.activeUserId) {
      adminUser = await this.userService.getUserById(ctx, ctx.activeUserId);
    }
    return this.adjustBalanceForWallet(
      ctx,
      amount,
      walletId,
      description,
      adminUser
    );
  }

  async payWithStoreCredit(
    ctx: RequestContext,
    order: Order,
    amount: number,
    walletId: ID
  ) {
    let customerUser: User | undefined;
    if (ctx.activeUserId) {
      customerUser = await this.userService.getUserById(ctx, ctx.activeUserId);
    }
    await this.adjustBalanceForWallet(
      ctx,
      -1 * amount,
      walletId,
      `paid for order ${order.code}`,
      customerUser
    );
  }

  async findOne(
    ctx: RequestContext,
    walletId: ID,
    relations?: RelationPaths<Wallet>
  ): Promise<Wallet | undefined> {
    const effectiveRelations = relations ?? this.relations.slice();
    const wallet = await this.connection.findOneInChannel(
      ctx,
      Wallet,
      walletId,
      ctx.channelId,
      {
        relations: unique(effectiveRelations),
      }
    );
    return wallet;
  }
}
