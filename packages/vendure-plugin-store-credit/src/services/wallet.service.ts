import { Injectable } from '@nestjs/common';
import { unique } from '@vendure/common/lib/unique';
import {
  assertFound,
  ChannelService,
  EventBus,
  ID,
  idsAreEqual,
  InternalServerError,
  ListQueryBuilder,
  ListQueryOptions,
  Logger,
  Order,
  OrderService,
  PaginatedList,
  Payment,
  PaymentService,
  Refund,
  RefundAmountError,
  RefundEvent,
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
import { summate } from '@vendure/common/lib/shared-utils';
import { loggerCtx } from '../constants';

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
    private readonly userService: UserService,
    private readonly eventBus: EventBus,
    private readonly orderService: OrderService
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
    const savedWallet = await this.connection
      .getRepository(ctx, Wallet)
      .save(wallet);
    const defaultChannel = await this.channelService.getDefaultChannel();
    await this.channelService.assignToChannels(
      ctx,
      Wallet,
      wallet.id,
      unique([defaultChannel.id, ctx.channel.id])
    );
    return assertFound(this.findOne(ctx, savedWallet.id));
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
      relations: ['channels'],
    });
    const isAllowedInChannel = wallet.channels.some((channel) =>
      idsAreEqual(channel.id, ctx.channelId)
    );
    if (!isAllowedInChannel) {
      throw new UserInputError(
        `Wallet with id ${walletId} is not assigned to the current channel`
      );
    }
    // Debit would violate CHECK (balance >= 0)
    if (amount < 0 && wallet.balance + amount < 0) {
      throw new UserInputError(
        `Insufficient balance. Wallet has ${
          wallet.balance
        }, cannot debit ${-amount}`
      );
    }
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
      walletId: ID;
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
    const wallet = await this.findOne(ctx, walletId);
    if (!wallet) {
      throw new UserInputError(
        `Wallet with id ${walletId} not found. Can not refund payment to this wallet.`
      );
    }
    if (wallet.currencyCode !== order.currencyCode) {
      throw new UserInputError(
        `Wallet currency '${wallet.currencyCode}' does not match order currency '${order.currencyCode}'. Can not refund payment to this wallet.`
      );
    }
    const [_, adjustment] = await this.adjustBalanceForWallet(
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
    walletId: ID
  ) {
    await this.adjustBalanceForWallet(
      ctx,
      -1 * amount,
      walletId,
      `Paid for order ${order.code}`
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        } as any,
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
}
