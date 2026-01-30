import { Injectable } from '@nestjs/common';
import {
  assertFound,
  ChannelService,
  Customer,
  ID,
  ListQueryBuilder,
  ListQueryOptions,
  Logger,
  PaginatedList,
  PaymentService,
  RelationPaths,
  RequestContext,
  TransactionalConnection,
  TranslatableSaver,
  Translated,
  TranslatorService,
} from '@vendure/core';
import { CreateWalletInput } from '../api/generated/graphql';
import { Wallet } from '../entities/wallet.entity';
import { WalletAdjustment } from '../entities/wallet-adjustment.entity';
import { WalletTranslation } from '../entities/wallet-translation.entity';
import { unique } from '@vendure/common/lib/unique';

@Injectable()
export class WalletService {
  private readonly relations = ['channels', 'customer', 'adjustments'];
  constructor(
    private readonly connection: TransactionalConnection,
    private translatableSaver: TranslatableSaver,
    private readonly channelService: ChannelService,
    private readonly listQueryBuilder: ListQueryBuilder,
    private readonly paymentService: PaymentService,
    private readonly translator: TranslatorService
  ) {}

  findAll(
    ctx: RequestContext,
    customerId: ID,
    options?: ListQueryOptions<Wallet>,
    relations: RelationPaths<Wallet> = []
  ): Promise<PaginatedList<Translated<Wallet>>> {
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
          items: items.map((item) => this.translator.translate(item, ctx)),
          totalItems,
        };
      });
  }

  async create(ctx: RequestContext, input: CreateWalletInput): Promise<Wallet> {
    const wallet = await this.translatableSaver.create({
      ctx,
      input,
      entityType: Wallet,
      translationType: WalletTranslation,
      beforeSave: async (w) => {
        await this.channelService.assignToCurrentChannel(w, ctx);
        const customer = await this.connection
          .getRepository(ctx, Customer)
          .findOneOrFail({ where: { id: input.customerId } });
        w.balance = 0;
        w.customer = customer;
      },
    });
    return assertFound(this.findOne(ctx, wallet.id));
  }

  async adjustBalanceForWallet(
    ctx: RequestContext,
    amount: number,
    walletId: ID
  ): Promise<Wallet> {
    const walletRepo = this.connection.getRepository(ctx, Wallet);
    const adjustmentRepo = this.connection.getRepository(ctx, WalletAdjustment);
    await walletRepo.findOneOrFail({ where: { id: walletId } });
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
  ): Promise<Translated<Wallet> | undefined> {
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
    if (!wallet) {
      return;
    }
    return this.translator.translate(wallet, ctx);
  }
}
