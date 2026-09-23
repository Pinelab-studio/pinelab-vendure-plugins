import { Inject, Injectable } from '@nestjs/common';
import {
  Channel,
  ChannelService,
  ConfigService,
  EventBus,
  ID,
  Logger,
  Order,
  OrderLine,
  OrderLineEvent,
  OrderService,
  RequestContext,
  RequestContextService,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { Brackets } from 'typeorm';
import { ORDER_CLEANUP_OPTIONS, loggerCtx } from '../constants';
import { NormalizedOrderCleanupPluginOptions } from '../order-cleanup.plugin';
import {
  getNextPageSize,
  ORDER_CLEANUP_PROCESSING_LIMIT,
  resolveOrderCleanupChannel,
  toBatches,
  toReadableDate,
} from './util';

const ELIGIBLE_STATES = ['AddingItems', 'Created', 'ArrangingPayment'] as const;

interface CleanupCursor {
  updatedAt: Date;
  id: ID;
}

type EmptyOrderOutcome = 'emptied' | 'failed' | 'skipped';

export interface OrderCleanupResult {
  processed: number;
  emptied: number;
  failed: number;
  skipped: number;
  reachedProcessingLimit: boolean;
}

@Injectable()
export class OrderCleanupService {
  constructor(
    private connection: TransactionalConnection,
    private orderService: OrderService,
    private requestContextService: RequestContextService,
    private channelService: ChannelService,
    private configService: ConfigService,
    private eventBus: EventBus,
    @Inject(ORDER_CLEANUP_OPTIONS)
    private options: NormalizedOrderCleanupPluginOptions
  ) {}

  /**
   * Empty stale active orders in bounded pages and concurrent batches.
   */
  async emptyStaleOrders(
    ctx: RequestContext,
    olderThanDays: number = this.options.olderThanDays,
    batchSize: number = this.options.batchSize
  ): Promise<OrderCleanupResult> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const defaultChannel = await this.channelService.getDefaultChannel(ctx);
    const result: OrderCleanupResult = {
      processed: 0,
      emptied: 0,
      failed: 0,
      skipped: 0,
      reachedProcessingLimit: false,
    };
    let cursor: CleanupCursor | undefined;

    Logger.info(
      `Emptying active orders older than ${olderThanDays} days`,
      loggerCtx
    );

    while (result.processed < ORDER_CLEANUP_PROCESSING_LIMIT) {
      const pageSize = getNextPageSize(result.processed);
      const orders = await this.findCandidates(ctx, cutoff, cursor, pageSize);
      if (orders.length === 0) {
        break;
      }

      const fromDate = toReadableDate(orders[0].updatedAt);
      const toDate = toReadableDate(orders[orders.length - 1].updatedAt);
      Logger.info(
        `Processing ${orders.length} stale orders between '${fromDate}' and '${toDate}'`,
        loggerCtx
      );

      const lastOrder = orders[orders.length - 1];
      cursor = { updatedAt: lastOrder.updatedAt, id: lastOrder.id };

      for (const batch of toBatches(orders, batchSize)) {
        const outcomes = await Promise.all(
          batch.map((order) => this.emptyOrder(defaultChannel, order, cutoff))
        );
        for (const outcome of outcomes) {
          result.processed++;
          result[outcome]++;
        }
      }

      if (orders.length < pageSize) {
        break;
      }
    }

    if (result.processed === ORDER_CLEANUP_PROCESSING_LIMIT) {
      result.reachedProcessingLimit = true;
      Logger.warn(
        `Processed ${result.processed} orders. More eligible orders will be processed in the next run.`,
        loggerCtx
      );
    }
    Logger.info(
      `Emptied ${result.emptied} stale orders; ${result.failed} failed and ${result.skipped} were skipped`,
      loggerCtx
    );
    return result;
  }

  /**
   * Find the next page of eligible non-empty orders using a stable cursor.
   */
  private findCandidates(
    ctx: RequestContext,
    cutoff: Date,
    cursor: CleanupCursor | undefined,
    take: number
  ): Promise<Order[]> {
    const query = this.connection
      .getRepository(ctx, Order)
      .createQueryBuilder('order')
      .innerJoin('order.lines', 'line')
      .leftJoinAndSelect('order.channels', 'channel')
      .where('order.state IN (:...states)', { states: ELIGIBLE_STATES })
      .andWhere('order.updatedAt < :cutoff', { cutoff })
      .distinct(true)
      .orderBy('order.updatedAt', 'ASC')
      .addOrderBy('order.id', 'ASC')
      .take(take);

    if (cursor) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('order.updatedAt > :cursorUpdatedAt', {
            cursorUpdatedAt: cursor.updatedAt,
          }).orWhere(
            'order.updatedAt = :cursorUpdatedAt AND order.id > :cursorId',
            {
              cursorUpdatedAt: cursor.updatedAt,
              cursorId: cursor.id,
            }
          );
        })
      );
    }
    return query.getMany();
  }

  /**
   * Empty one order atomically and convert all failures into a logged outcome.
   */
  private async emptyOrder(
    defaultChannel: Channel,
    candidate: Order,
    cutoff: Date
  ): Promise<EmptyOrderOutcome> {
    try {
      const channel = resolveOrderCleanupChannel(
        candidate.channels,
        defaultChannel
      );
      const orderContext = await this.requestContextService.create({
        apiType: 'admin',
        channelOrToken: channel,
      });

      return await this.connection.withTransaction(
        orderContext,
        async (transactionContext) => {
          const order = await this.orderService.findOne(
            transactionContext,
            candidate.id
          );
          if (!order || !this.isEligible(order, cutoff)) {
            return 'skipped';
          }

          const originalState = order.state;
          for (const line of order.lines) {
            for (const interceptor of this.configService.orderOptions
              .orderInterceptors) {
              const error = await interceptor.willRemoveItemFromOrder?.(
                transactionContext,
                order,
                line
              );
              if (error) {
                throw new Error(error);
              }
            }
          }

          const deletedOrderLines = order.lines.map(
            (line) => new OrderLine(line)
          );
          await this.connection
            .getRepository(transactionContext, OrderLine)
            .remove(order.lines);
          order.lines = [];
          const updatedOrder = await this.orderService.applyPriceAdjustments(
            transactionContext,
            order
          );
          if (updatedOrder.state !== originalState) {
            throw new Error(
              `Order state changed from '${originalState}' to '${updatedOrder.state}' while emptying`
            );
          }
          for (const deletedOrderLine of deletedOrderLines) {
            await this.eventBus.publish(
              new OrderLineEvent(
                transactionContext,
                updatedOrder,
                deletedOrderLine,
                'deleted'
              )
            );
          }
          Logger.debug(
            `Emptied order ${updatedOrder.code} (${updatedOrder.id}) in state ${updatedOrder.state}`,
            loggerCtx
          );
          return 'emptied';
        }
      );
    } catch (error) {
      Logger.error(
        `Error emptying order ${candidate.id}: ${asError(error).message}`,
        loggerCtx
      );
      return 'failed';
    }
  }

  /**
   * Re-check candidate eligibility immediately before mutation.
   */
  private isEligible(order: Order, cutoff: Date): boolean {
    return (
      ELIGIBLE_STATES.includes(
        order.state as (typeof ELIGIBLE_STATES)[number]
      ) &&
      order.updatedAt < cutoff &&
      order.lines.length > 0
    );
  }
}
