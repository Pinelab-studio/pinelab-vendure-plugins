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
} from '@vendure/core';
import { AUTO_CANCEL_ORDERS_OPTIONS } from '../constants';
import { AutoCancelOrdersOptions } from '../auto-cancel-orders.plugin';

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
    // find orders older than the given number of days
    let hasMore = true;
    while (hasMore) {
      const orders = await this.connection.getRepository(ctx, Order).find({
        where: {
          active: true,
          updated: LessThan(olderThanDays),
        },
      });
    }
  }
}
