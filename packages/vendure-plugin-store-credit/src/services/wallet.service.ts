import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { summate } from '@vendure/common/lib/shared-utils';
import { unique } from '@vendure/common/lib/unique';
import {
  assertFound,
  ChannelService,
  EventBus,
  ID,
  idsAreEqual,
  Injector,
  InternalServerError,
  ListQueryBuilder,
  ListQueryOptions,
  Logger,
  Order,
  OrderLine,
  OrderPlacedEvent,
  OrderService,
  PaginatedList,
  Payment,
  PaymentMetadata,
  Refund,
  RefundEvent,
  RelationPaths,
  RequestContext,
  TransactionalConnection,
  User,
  UserInputError,
  UserService,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { CreateWalletInput } from '../api/generated/graphql';
import { loggerCtx, STORE_CREDIT_PLUGIN_OPTIONS } from '../constants';
import { WalletAdjustment } from '../entities/wallet-adjustment.entity';
import { Wallet } from '../entities/wallet.entity';
import { QueryFailedError, IsNull, Not } from 'typeorm';
import { GiftCardWalletCreatedEvent } from '../events/gift-card-wallet-created.event';
import { StoreCreditPluginOptions } from '../types';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class WalletService implements OnApplicationBootstrap {
  private readonly relations = [
    'channels',
    'customer',
    'adjustments.mutatedBy',
  ];
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly channelService: ChannelService,
    private readonly listQueryBuilder: ListQueryBuilder,
    private readonly userService: UserService,
    private readonly eventBus: EventBus,
    private readonly moduleRef: ModuleRef,
    private readonly orderService: OrderService,
    @Optional()
    @Inject(STORE_CREDIT_PLUGIN_OPTIONS)
    private options?: StoreCreditPluginOptions
  ) {}

  onApplicationBootstrap() {
    this.eventBus.ofType(OrderPlacedEvent).subscribe((payload) => {
      this.createGiftCardsForOrder(payload.ctx, payload.order).catch((err) => {
        Logger.error(
          `Error creating gift card wallets for order ${payload.order.code}: ${
            asError(err).message
          }`,
          loggerCtx
        );
      });
    });
  }

  /**
   * Creates all gift card wallets for all eligible order lines and emits
   * one event per order containing all created gift card wallets.
   */
  async createGiftCardsForOrder(ctx: RequestContext, order: Order) {
    const createdWallets: Wallet[] = [];
    for (const line of order.lines) {
      try {
        const wallets = await this.createGiftCardForOrderLine(ctx, order, line);
        createdWallets.push(...wallets);
      } catch (err) {
        Logger.error(
          `Error creating gift card wallet for order line ${line.id} in order ${
            order.code
          }: ${asError(err).message}`,
          loggerCtx
        );
      }
    }
    if (createdWallets.length > 0) {
      void this.eventBus.publish(
        new GiftCardWalletCreatedEvent(ctx, createdWallets, order)
      );
    }
  }

  /**
   * Called for each order line of a placed order. If the configured
   * `createGiftCardWallet` strategy returns a result for the given line, a gift
   * card wallet is created per quantity of the line. The wallet `code` is made
   * unique by suffixing `-N` when a code already exists in the DB.
   */
  async createGiftCardForOrderLine(
    ctx: RequestContext,
    order: Order,
    line: OrderLine
  ): Promise<Wallet[]> {
    const result = await this.options?.createGiftCardWallet?.(
      ctx,
      new Injector(this.moduleRef),
      order,
      line
    );

    if (!result) {
      return [];
    }

    const createdWallets: Wallet[] = [];

    const { price, cardCode } = result;

    for (let i = 0; i < line.quantity; i++) {
      const finalCode = await this.getUniqueCode(ctx, cardCode);

      const wallet = await this.create(
        ctx,
        {
          customerId: order.customerId,
          name: finalCode,
        },
        finalCode
      );
      const [walletWithBalance] = await this.adjustBalanceForWallet(
        ctx,
        price,
        wallet.id,
        `Initial gift card balance for order ${order.code}`
      );
      createdWallets.push(walletWithBalance);

      await this.orderService.addNoteToOrder(ctx, {
        id: order.id,
        note: `Gift card wallet ${finalCode} created with balance ${
          price / 100
        } for product with id ${line.productVariant?.productId}`,
        isPublic: false,
      });
    }

    return createdWallets;
  }

  /**
   * Returns a wallet code that does not yet exist in the database.
   * If `baseCode` is already taken, `-2`, `-3`, ... are appended until a
   * unique code is found.
   */
  async getUniqueCode(ctx: RequestContext, baseCode: string): Promise<string> {
    const repo = this.connection.getRepository(ctx, Wallet);
    let candidate = baseCode;
    let suffix = 1;
    while (await repo.findOne({ where: { code: candidate } })) {
      suffix += 1;
      candidate = `${baseCode}-${suffix}`;
    }
    return candidate;
  }

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

  findAdjustmentsForWallet(
    ctx: RequestContext,
    walletId: ID,
    options?: ListQueryOptions<WalletAdjustment>,
    relations: RelationPaths<WalletAdjustment> = []
  ): Promise<PaginatedList<WalletAdjustment>> {
    return this.listQueryBuilder
      .build(WalletAdjustment, options, {
        relations: relations ?? ['mutatedBy'],
        ctx,
        where: { wallet: { id: walletId } },
      })
      .getManyAndCount()
      .then(([items, totalItems]) => {
        return {
          items,
          totalItems,
        };
      });
  }

  async create(
    ctx: RequestContext,
    input: CreateWalletInput,
    code?: string
  ): Promise<Wallet> {
    if (!input.customerId && !code) {
      throw new UserInputError(
        'Either a customerId or a code must be provided to create a wallet'
      );
    }
    const wallet = new Wallet({
      name: input.name,
      customer: { id: input.customerId },
      balance: 0,
      code,
      currencyCode: ctx.channel.defaultCurrencyCode,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      metadata: input.metadata ?? undefined,
    });
    let savedWallet: Wallet;
    try {
      savedWallet = await this.connection
        .getRepository(ctx, Wallet)
        .save(wallet);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        if (error.message.includes('UNIQUE constraint failed')) {
          throw new UserInputError(
            `Wallet with name '${input.name}' already exists for customer ${input.customerId}`
          );
        }
      }
      throw error;
    }
    const defaultChannel = await this.channelService.getDefaultChannel();
    await this.channelService.assignToChannels(
      ctx,
      Wallet,
      wallet.id,
      unique([defaultChannel.id, ctx.channel.id])
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const foundWallet = await this.findOne(ctx, savedWallet!.id);
    if (!foundWallet) {
      throw new InternalServerError('Wallet was not found after creation');
    }
    return foundWallet;
  }

  async adjustBalanceForWallet(
    ctx: RequestContext,
    amount: number,
    walletId: ID,
    description: string
  ): Promise<[Wallet, WalletAdjustment]> {
    let user: User | undefined;
    if (ctx.activeUserId) {
      user = await this.userService.getUserById(ctx, ctx.activeUserId);
    }
    const walletRepo = this.connection.getRepository(ctx, Wallet);
    const adjustmentRepo = this.connection.getRepository(ctx, WalletAdjustment);

    const wallet = await walletRepo.findOneOrFail({
      where: { id: walletId },
      relations: ['channels', 'customer'],
    });

    if (
      ctx.apiType === 'shop' &&
      wallet.customer?.user?.id &&
      !idsAreEqual(wallet.customer?.user?.id, user?.id)
    ) {
      throw new UserInputError(
        `Wallet with id ${walletId} is not assigned to the current user`
      );
    }

    const isAllowedInChannel = wallet.channels.some((channel) =>
      idsAreEqual(channel.id, ctx.channelId)
    );
    if (!isAllowedInChannel) {
      throw new UserInputError(
        `Wallet with id ${walletId} is not assigned to the current channel`
      );
    }
    // Atomic balance update: the WHERE clause ensures we never end up with a
    // negative balance even under concurrent debits. If the condition does not
    // match we throw an "insufficient balance" error.
    const res = await walletRepo
      .createQueryBuilder()
      .update(Wallet)
      .set({ balance: () => `balance + :amount` })
      .where('id = :id AND balance + :amount >= 0', { id: walletId, amount })
      .execute();

    if ((res.affected ?? 0) === 0) {
      throw new UserInputError(
        `Insufficient balance. Wallet has ${
          wallet.balance
        }, cannot debit ${-amount}`
      );
    } else if ((res.affected ?? 0) > 1) {
      // This should never happen since id is unique, but we check just in case
      throw new InternalServerError(
        `Unexpected error adjusting wallet balance: ${res.affected} wallets were updated`
      );
    }

    const adjustment = await adjustmentRepo.save(
      adjustmentRepo.create({
        wallet: { id: walletId } as Wallet,
        amount,
        description,
        mutatedBy: user,
      })
    );
    const updatedWallet = await assertFound(this.findOne(ctx, walletId));
    return [updatedWallet, adjustment];
  }

  /**
   * Refund a given payment to the store credit wallet.
   *
   * If `shouldCreateRefundEntity=true` a new refund will be created for the given payment.
   * This is needed when we do a refund of a 'real' payment to a store credit wallet.
   *
   * `shouldCreateRefundEntity=false` when this is called from the payment method handler.
   * In that case Vendure will automatically create a refund for the given payment.
   */
  async refundToStoreCredit(
    ctx: RequestContext,
    input: {
      order: Order;
      payment: Payment;
      amount: number;
      walletId?: ID;
      shouldCreateRefundEntity: boolean;
      reason?: string;
    }
  ): Promise<WalletAdjustment> {
    const {
      order,
      payment,
      amount,
      walletId,
      shouldCreateRefundEntity,
      reason: inputReason,
    } = input;
    const reason = inputReason ?? 'No reason provided';
    if (!walletId) {
      throw new UserInputError(
        'Wallet ID is required to refund to store credit.'
      );
    }
    const wallet = await this.findOne(ctx, walletId);
    if (!wallet) {
      throw new UserInputError(
        `Wallet with id ${walletId} not found. Can not refund payment to this wallet.`
      );
    }
    if (String(wallet.currencyCode) !== String(order.currencyCode)) {
      throw new UserInputError(
        `Wallet currency '${wallet.currencyCode}' does not match order currency '${order.currencyCode}'. Can not refund payment to this wallet.`
      );
    }
    const [, adjustment] = await this.adjustBalanceForWallet(
      ctx,
      amount,
      walletId,
      `Refund for order ${payment.order.code}: ${reason}`
    );
    if (shouldCreateRefundEntity) {
      // This means we should create a refund entity, because this was called outside of a payment method handler.
      await this.createRefund(
        ctx,
        amount,
        reason,
        order,
        payment,
        adjustment,
        wallet
      );
    }
    return adjustment;
  }

  async payWithStoreCredit(
    ctx: RequestContext,
    order: Order,
    amount: number,
    metadata: PaymentMetadata
  ) {
    if (metadata.walletId) {
      await this.adjustBalanceForWallet(
        ctx,
        -1 * amount,
        metadata.walletId as ID,
        `Paid for order ${order.code}`
      );
    }
    if (metadata.giftCardCode) {
      const wallet = await this.findByCode(
        ctx,
        metadata.giftCardCode as string
      );
      if (!wallet) {
        throw new UserInputError(
          `No wallet found for gift card code '${metadata.giftCardCode}'`
        );
      }
      await this.adjustBalanceForWallet(
        ctx,
        -1 * amount,
        wallet?.id,
        `Paid for order ${order.code}`
      );
    }
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

  async findByCode(
    ctx: RequestContext,
    code: string,
    relations?: RelationPaths<Wallet>
  ): Promise<Wallet | null> {
    const effectiveRelations = relations ?? this.relations.slice();
    // Channel-scoped lookup: only return a wallet when it is assigned to the
    // current channel, to prevent leaking wallet data across channels.
    const wallet = await this.connection
      .getRepository(ctx, Wallet)
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.channels', 'channel')
      .where('wallet.code = :code', { code })
      .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
      .getOne();
    if (!wallet) {
      return null;
    }
    // Re-fetch with requested relations now that we've confirmed channel access.
    return (
      (await this.connection.getRepository(ctx, Wallet).findOne({
        where: { id: wallet.id },
        relations: unique(effectiveRelations),
      })) ?? null
    );
  }

  /**
   * This is based on Vendure's RefundService.createRefund, with some minor adjustments.
   *
   * This logic is needed because we need to manually create a refund entity with our custom
   * `refundToStoreCredit` mutation, because that works outside of a payment method handler.
   */
  private async createRefund(
    ctx: RequestContext,
    amount: number,
    reason: string,
    order: Order,
    payment: Payment,
    adjustment: WalletAdjustment,
    wallet: Wallet
  ): Promise<Refund[]> {
    const orderWithRefunds = await this.connection.getEntityOrThrow(
      ctx,
      Order,
      order.id,
      {
        relations: ['payments', 'payments.refunds'],
      }
    );
    const paymentToRefund = orderWithRefunds.payments.find((p) =>
      idsAreEqual(p.id, payment.id)
    );
    if (!paymentToRefund) {
      throw new InternalServerError('Could not find a Payment to refund');
    }
    const refundableAmount =
      paymentToRefund.amount - this.getPaymentRefundTotal(paymentToRefund);
    if (refundableAmount < amount) {
      throw new UserInputError(
        `Refund amount ${amount} is greater than payment amount ${refundableAmount}.`
      );
    }
    const refundsCreated: Refund[] = [];
    const refundablePayments = orderWithRefunds.payments.filter((p) => {
      return this.getPaymentRefundTotal(p) < p.amount;
    });
    const refundedPaymentIds: ID[] = [];
    const total = amount;
    const refundMax =
      orderWithRefunds.payments
        ?.map((p) => p.amount - this.getPaymentRefundTotal(p))
        .reduce((sum, amount) => sum + amount, 0) ?? 0;
    let refundOutstanding = Math.min(total, refundMax);
    // Create refunds for multiple payments if needed
    do {
      const paymentToRefund =
        (refundedPaymentIds.length === 0 &&
          refundablePayments.find((p) => idsAreEqual(p.id, payment.id))) ||
        refundablePayments.find((p) => !refundedPaymentIds.includes(p.id));
      if (!paymentToRefund) {
        throw new InternalServerError('Could not find a Payment to refund');
      }
      const amountNotRefunded =
        paymentToRefund.amount - this.getPaymentRefundTotal(paymentToRefund);
      const constrainedTotal = Math.min(amountNotRefunded, refundOutstanding);
      let refund = new Refund({
        payment: paymentToRefund,
        total: constrainedTotal,
        reason,
        method: payment.method,
        state: 'Settled',
        metadata: {
          walletId: String(wallet.id),
          walletAdjustmentId: String(adjustment.id),
        } as Refund['metadata'],
        shipping: 0,
        items: 0,
        adjustment: 0,
        transactionId: `Refunded to wallet '${wallet.name}' (${wallet.id})`,
      });
      refund = await this.connection.getRepository(ctx, Refund).save(refund);
      refundsCreated.push(refund);
      refundedPaymentIds.push(paymentToRefund.id);
      refundOutstanding = total - summate(refundsCreated, 'total');
    } while (0 < refundOutstanding);
    await this.orderService
      .addNoteToOrder(ctx, {
        id: order.id,
        note: `Refunded ${amount} for order ${order.code}: ${reason}`,
        isPublic: false,
      })
      .catch((err) => {
        Logger.error(
          `Error adding note to order ${order.id}: ${err}`,
          loggerCtx
        );
      });
    for (const refund of refundsCreated) {
      await this.eventBus.publish(
        new RefundEvent(ctx, order, refund, 'created')
      );
    }
    return refundsCreated;
  }

  private getPaymentRefundTotal(payment: Payment): number {
    const nonFailedRefunds =
      payment.refunds?.filter((refund) => refund.state !== 'Failed') ?? [];
    return summate(nonFailedRefunds, 'total');
  }

  getGiftCardWallets(
    ctx: RequestContext,
    options?: ListQueryOptions<Wallet>,
    relations: RelationPaths<Wallet> = []
  ): Promise<PaginatedList<Wallet>> {
    return this.listQueryBuilder
      .build(Wallet, options, {
        ctx,
        channelId: ctx.channelId,
        where: {
          code: Not(IsNull()),
        },
        relations,
      })
      .getManyAndCount()
      .then(([items, totalItems]) => {
        return {
          items,
          totalItems,
        };
      });
  }
}
