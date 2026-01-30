import { Injectable } from '@nestjs/common';
import { unique } from '@vendure/common/lib/unique';
import {
  assertFound,
  ChannelService,
  ID,
  ListQueryBuilder,
  ListQueryOptions,
  Logger,
  PaginatedList,
  PaymentService,
  RelationPaths,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { CreateWalletInput } from '../api/generated/graphql';
import { WalletAdjustment } from '../entities/wallet-adjustment.entity';
import { Wallet } from '../entities/wallet.entity';

@Injectable()
export class WalletService {
  private readonly relations = ['channels', 'customer', 'adjustments'];
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly channelService: ChannelService,
    private readonly listQueryBuilder: ListQueryBuilder,
    private readonly paymentService: PaymentService
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
      name: input.name,
      customer: { id: input.customerId },
      balance: 0,
      currencyCode: ctx.channel.defaultCurrencyCode,
    });
    await this.channelService.assignToCurrentChannel(wallet, ctx);
    const saved = await this.connection.getRepository(ctx, Wallet).save(wallet);
    return assertFound(this.findOne(ctx, saved.id));
  }

  async adjustBalanceForWallet(
    ctx: RequestContext,
    amount: number,
    walletId: ID
  ): Promise<Wallet> {
    const walletRepo = this.connection.getRepository(ctx, Wallet);
    const adjustmentRepo = this.connection.getRepository(ctx, WalletAdjustment);
    const wallet = await walletRepo.findOneOrFail({ where: { id: walletId } });
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
      })
    );

    return assertFound(this.findOne(ctx, walletId));
  }

  async refundPaymentToStoreCredit(
    ctx: RequestContext,
    paymentId: ID,
    walletId: ID
  ) {
    const payment = await this.paymentService.findOneOrThrow(ctx, paymentId);
    return this.adjustBalanceForWallet(ctx, -1 * payment.amount, walletId);
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
