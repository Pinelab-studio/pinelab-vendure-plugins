import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  JobQueue,
  JobQueueService,
  Order,
  OrderService,
  RequestContext,
  ID,
  TransactionalConnection,
  SerializedRequestContext,
  Logger,
  isGraphQlErrorResult,
} from '@vendure/core';
import { AUTO_CANCEL_ORDERS_OPTIONS, loggerCtx } from '../constants';
import { AutoCancelOrdersOptions } from '../auto-cancel-orders.plugin';
import { In, LessThan } from 'typeorm';
import { asError } from 'catch-unknown';
import { toReadableDate } from './util';
@Injectable()
export class AutoCancelOrdersService implements OnModuleInit {
  private jobQueue!: JobQueue<{
    ctx: SerializedRequestContext;
    olderThanDays: number;
  }>;

  constructor(
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private orderService: OrderService,
    @Inject(AUTO_CANCEL_ORDERS_OPTIONS) private options: AutoCancelOrdersOptions
  ) {}

  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'auto-cancel-orders',
      process: async (job) => {
        const ctx = RequestContext.deserialize(job.data.ctx);
        await this.cancelStaleOrders(ctx, job.data.olderThanDays);
      },
    });
  }

  async triggerCancelOrders(ctx: RequestContext) {
    await this.jobQueue.add({
      ctx: ctx.serialize(),
      olderThanDays: this.options.olderThanDays,
    });
  }

  /**
   * Cancel all stale orders that have not been updated in the given number of days.
   * Only cancels orders that are in `AddingItems` or `Created` state.
   *
   * Batch size is the amount of orders that will be cancelled in parallel.
   */
  async cancelStaleOrders(
    ctx: RequestContext,
    olderThanDays: number,
    batchSize: number = 10
  ) {
    // Find orders older than the given number of days
    const olderThanDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    );
    let hasMore = true;
    Logger.info(
      `Cancelling active orders older than ${olderThanDays} days`,
      loggerCtx
    );
    let processedOrders = 0;
    let cancelledOrders = 0;
    while (hasMore) {
      const [orders, total] = await this.connection
        .getRepository(ctx, Order)
        .findAndCount({
          select: ['id', 'updatedAt'],
          where: {
            state: In(['AddingItems', 'Created', 'ArrangingPayment']),
            updatedAt: LessThan(olderThanDate),
          },
          order: {
            updatedAt: 'ASC',
          },
          take: 1000,
        });
      if (orders.length === 0) {
        break;
      }
      if (orders.length < 100) {
        // Set hasMore to false, so the job will stop after this round
        hasMore = false;
      }
      const fromDate = toReadableDate(orders[0].updatedAt);
      const toDate = toReadableDate(orders[orders.length - 1].updatedAt);
      Logger.info(
        `Cancelling ${orders.length} orders of total ${total} between '${fromDate}' and '${toDate}'. `,
        loggerCtx
      );
      const batches = this.getBatches(orders, batchSize);
      for (const batch of batches) {
        // Process batch concurrently
        await Promise.all(
          batch.map(async (order) => {
            const result = await this.cancelOrder(ctx, order.id);
            if (result) {
              cancelledOrders++;
            }
            processedOrders++;
          })
        );
      }
      if (processedOrders > 10000) {
        // Prevent infite loops, where orders are not cancellable, and thus stay in the resultset
        Logger.warn(
          `Processed ${processedOrders} orders. More orders will be processed in the next run.`,
          loggerCtx
        );
        break;
      }
    }
    Logger.info(`Cancelled ${cancelledOrders} active orders`, loggerCtx);
  }

  /**
   * Cancel a single order.
   * Logs any errors instead of throwing them so that the job can continue.
   */
  private async cancelOrder(
    ctx: RequestContext,
    orderId: ID
  ): Promise<boolean> {
    try {
      const result = await this.orderService.cancelOrder(ctx, {
        orderId,
        reason: `Automated cancellation after ${this.options.olderThanDays} days of inactivity by '${loggerCtx}'`,
      });
      if (isGraphQlErrorResult(result)) {
        throw result;
      }
      Logger.debug(`Cancelled order ${result.code} (${result.id})`, loggerCtx);
      return true;
    } catch (e) {
      Logger.error(
        `Error cancelling order ${orderId}: ${asError(e).message}`,
        loggerCtx
      );
      return false;
    }
  }

  private getBatches<T>(array: T[], batchSize: number): T[][] {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}
