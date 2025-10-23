import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  CacheService,
  EventBus,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  StockLevelService,
  StockMovementEvent,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { StockMonitoringPluginOptions } from '../types';
import { StockDroppedBelowThresholdEvent } from './stock-dropped-below-threshold';

type StockMonitoringJobData = {
  ctx: SerializedRequestContext;
  orderId: ID;
  lines: Array<{
    variantId: ID;
    variantStockThreshold?: number;
    orderLineQuantity: number;
  }>;
};

@Injectable()
export class StockMonitoringService
  implements OnModuleInit, OnApplicationBootstrap
{
  private jobQueue!: JobQueue<StockMonitoringJobData>;

  constructor(
    private readonly connection: TransactionalConnection,
    private readonly jobQueueService: JobQueueService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: StockMonitoringPluginOptions,
    private readonly variantService: ProductVariantService,
    private readonly cacheService: CacheService,
    private readonly stockLevelService: StockLevelService,
    private readonly eventBus: EventBus,
    private readonly orderService: OrderService
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'stock-monitoring',
      process: async (job) =>
        await this.handleStockMonitoringJob(
          RequestContext.deserialize(job.data.ctx),
          job.data
        ),
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    // Trigger stock monitoring event for each Order Placed Event
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      await this.triggerStockMonitoring(event.ctx, event.order).catch((e) => {
        Logger.error(
          `Error triggering stock monitoring for order ${event.order.code}: ${e}`,
          loggerCtx,
          asError(e).stack
        );
      });
    });
    // Bust cache when stock is updated
    this.eventBus.ofType(StockMovementEvent).subscribe(async (event) => {
      const cacheKey = this.getCacheKey(event.ctx);
      this.cacheService.delete(cacheKey);
    });
  }

  async getVariantsBelowThreshold(
    ctx: RequestContext,
    limit: number = 10
  ): Promise<ProductVariant[]> {
    // See if we have cached the variant ids for this channel and limit
    const cacheKey = this.getCacheKey(ctx);
    let variantIds = await this.cacheService.get<ID[]>(cacheKey);
    if (!variantIds) {
      // No cache hit, so we lookup what variants are below the threshold and cache the ids
      const result = await this.connection
        .getRepository(ctx, ProductVariant)
        .createQueryBuilder('pv')
        .leftJoin('pv.stockLevels', 'sl')
        .select([
          'pv.id',
          'pv.sku',
          'pv.enabled',
          'pv.trackInventory',
          'pv.customFieldsStockmonitoringthreshold',
          'COALESCE(SUM(sl.stockOnHand - sl.stockAllocated), 0) as availableStock',
          `COALESCE(pv.customFieldsStockmonitoringthreshold, ${this.options.globalThreshold}) as threshold`,
        ])
        .where('pv.deletedAt IS NULL')
        .andWhere('pv.enabled = :enabled', { enabled: true })
        .andWhere('pv.trackInventory != :trackInventory', {
          trackInventory: false,
        })
        .groupBy('pv.id')
        .having('availableStock < threshold')
        .limit(limit)
        .orderBy('availableStock', 'ASC')
        .getMany();
      variantIds = result.map((v) => v.id);
      await this.cacheService.set(cacheKey, variantIds, { ttl: 60000 });
    }
    const variants = await this.variantService.findByIds(ctx, variantIds);
    return variants;
  }

  async triggerStockMonitoring(
    ctx: RequestContext,
    order: Order
  ): Promise<void> {
    await this.jobQueue.add({
      ctx: ctx.serialize(),
      lines: order.lines.map((line) => ({
        variantId: line.productVariant.id,
        variantStockThreshold:
          line.productVariant.customFields.stockMonitoringThreshold,
        orderLineQuantity: line.quantity,
      })),
      orderId: order.id,
    });
  }

  /**
   * Emit event when the stock level of a variant dropped below its threshold by a placed order.
   */
  async handleStockMonitoringJob(
    ctx: RequestContext,
    jobData: StockMonitoringJobData
  ): Promise<void> {
    for (const line of jobData.lines) {
      const threshold =
        line.variantStockThreshold || this.options.globalThreshold;
      const stockLevels = await this.stockLevelService.getAvailableStock(
        ctx,
        line.variantId
      );
      const currentStock = stockLevels.stockOnHand - stockLevels.stockAllocated;
      const stockBeforeOrder = currentStock + line.orderLineQuantity;
      const stockAfterOrder = currentStock;
      if (stockAfterOrder <= threshold && stockBeforeOrder >= threshold) {
        const productVariant = await this.variantService.findOne(
          ctx,
          line.variantId
        );
        if (!productVariant) {
          Logger.error(
            `Product variant not found for id ${line.variantId}. Can not emit stock notification event.`,
            loggerCtx
          );
          continue;
        }
        const order = await this.orderService.findOne(ctx, jobData.orderId);
        this.eventBus.publish(
          new StockDroppedBelowThresholdEvent(
            ctx,
            productVariant,
            stockBeforeOrder,
            stockAfterOrder,
            order
          )
        );
      }
    }
  }

  private getCacheKey(ctx: RequestContext): string {
    return `low-stock-variants-${ctx.channel.id}`;
  }
}
