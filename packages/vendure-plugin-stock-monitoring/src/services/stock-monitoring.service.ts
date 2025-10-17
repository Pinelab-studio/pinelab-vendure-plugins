import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { JobState } from '@vendure/common/lib/generated-types';
import {
  CacheService,
  EventBus,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderLine,
  OrderPlacedEvent,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  StockLevel,
  StockLevelService,
  TransactionalConnection,
} from '@vendure/core';
import { StockMonitoringPluginOptions } from '../types';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';

type StockMonitoringJobData = {
  ctx: SerializedRequestContext;
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
    private readonly eventBus: EventBus
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
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      await this.triggerStockMonitoring(event.ctx, event.order).catch((e) => {
        Logger.error(
          `Error triggering stock monitoring for order ${event.order.code}: ${e}`,
          loggerCtx,
          (e as Error).stack // TODO catch-unknown
        );
      });
    });
  }

  async getVariantsBelowThreshold(
    ctx: RequestContext,
    limit: number = 10
  ): Promise<ProductVariant[]> {
    // See if we have cached the variant ids for this channel and limit
    const cacheKey = `low-stock-variants-${ctx.channel.id}-${limit}`;
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
    });
  }

  async handleStockMonitoringJob(
    ctx: RequestContext,
    jobData: StockMonitoringJobData
  ): Promise<void> {
    // TODO
  }

  /**
   * Returns true if this orderLine made the stock level drop below the threshold
   */
  async droppedBelowThreshold(
    line: OrderLine,
    ctx: RequestContext
  ): Promise<boolean> {
    const threshold =
      line.productVariant.customFields.stockMonitoringThreshold ||
      this.options.globalThreshold;
    const { productVariant, quantity } = line;
    const variantStocks = await this.stockLevelService.getAvailableStock(
      ctx,
      productVariant.id
    );
    const stockAfterOrder = variantStocks.stockOnHand;
    const stockBeforeOrder = stockAfterOrder + quantity;
    return stockAfterOrder <= threshold && stockBeforeOrder >= threshold;
  }
}
