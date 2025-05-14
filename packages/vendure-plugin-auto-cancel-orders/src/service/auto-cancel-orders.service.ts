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
} from '@vendure/core';
import { AUTO_CANCEL_ORDERS_OPTIONS, loggerCtx } from '../constants';
import { AutoCancelOrdersOptions } from '../auto-cancel-orders.plugin';
import { LessThan } from 'typeorm';

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
        await this.cancelActiveOrders(ctx, job.data.olderThanDays);
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
   * Cancel all active orders that have not been updated in the given number of days
   */
  async cancelActiveOrders(ctx: RequestContext, olderThanDays: number) {
    // Find orders older than the given number of days
    const olderThanDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    );
    let hasMore = true;
    Logger.info(
      `Cancelling active orders older than ${olderThanDays} days`,
      loggerCtx
    );
    while (hasMore) {
      const orders = await this.connection.getRepository(ctx, Order).find({
        where: {
          active: true,
          updatedAt: LessThan(olderThanDate),
        },
        order: {
          updatedAt: 'ASC',
        },
        take: 100,
      });
      Logger.info(
        `Cancelling ${orders.length} orders from ${orders[0].updatedAt} to ${
          orders[orders.length - 1].updatedAt
        }`,
        loggerCtx
      );
      for (const order of orders) {
        await this.orderService.cancelOrder(ctx, order.id);
      }
    }
  }
}
