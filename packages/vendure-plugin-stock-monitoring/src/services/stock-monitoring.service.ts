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
  variantId: ID;
  /**
   * The amount with which the stock was decreased. E.g. 3 means stock was decreased by 3.
   * This decrement already happened by the time this job is created.
   *
   * Decrement could be caused by adjustments, sales, or allocations.
   */
  saleableStockDecrement: number;
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

  onApplicationBootstrap(): void {
    this.eventBus.ofType(StockMovementEvent).subscribe((event) => {
      // Bust cache when stock is updated. This cache is used to cache variants that are out of stock (or below threshold)
      const cacheKey = this.getCacheKey(event.ctx);
      this.cacheService.delete(cacheKey).catch((e) => {
        Logger.error(
          `Error deleting cache for stock movement event: ${e}`,
          loggerCtx,
          asError(e).stack
        );
      });
      // Create jobs for stock movements that decrease saleable stock
      for (const movement of event.stockMovements) {
        let stockDecrement: number | undefined;
        if (event.type === 'ALLOCATION') {
          stockDecrement = movement.quantity; // Allocation movements are positive, because they add to allocated stock
        } else if (event.type === 'SALE') {
          stockDecrement = Math.abs(movement.quantity); // Sale movements are negative
        } else if (event.type === 'ADJUSTMENT' && movement.quantity < 0) {
          stockDecrement = Math.abs(movement.quantity);
        }
        if (stockDecrement !== undefined) {
          this.jobQueue
            .add({
              ctx: event.ctx.serialize(),
              variantId: movement.productVariant.id,
              saleableStockDecrement: stockDecrement,
            })
            .catch((e) => {
              Logger.error(
                `Error adding stock monitoring job for variant ${movement.productVariant.id}: ${e}`,
                loggerCtx,
                asError(e).stack
              );
            });
        }
      }
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
        .andWhere('pv.trackInventory != "FALSE"')
        .groupBy('pv.id')
        .having('availableStock < threshold')
        .limit(limit)
        .orderBy('availableStock', 'ASC')
        .getMany();
      variantIds = result.map((v) => v.id);
      await this.cacheService.set(cacheKey, variantIds, { ttl: 60000 });
    }
    const variants = await this.variantService.findByIds(ctx, variantIds);
    // findByIds does not preserve input order, so re-sort to match the cached ASC order
    const idOrder = new Map(
      variantIds.map((id, index) => [id.toString(), index])
    );
    variants.sort(
      (a, b) =>
        (idOrder.get(a.id.toString()) ?? 0) -
        (idOrder.get(b.id.toString()) ?? 0)
    );
    return variants;
  }

  /**
   * Emit event when the stock level of a variant dropped below its threshold.
   */
  async handleStockMonitoringJob(
    ctx: RequestContext,
    jobData: StockMonitoringJobData
  ): Promise<void> {
    const stockLevels = await this.stockLevelService.getAvailableStock(
      ctx,
      jobData.variantId
    );
    const stockAfterAdjustment =
      stockLevels.stockOnHand - stockLevels.stockAllocated;
    const stockBeforeAdjustment =
      stockAfterAdjustment + jobData.saleableStockDecrement;
    const [variant] = await this.variantService.findByIds(ctx, [
      jobData.variantId,
    ]);
    if (!variant) {
      Logger.error(
        `Variant ${jobData.variantId} not found while handling stock monitoring job`,
        loggerCtx
      );
      return;
    }
    const threshold =
      variant.customFields.stockMonitoringThreshold ??
      this.options.globalThreshold;
    if (
      stockBeforeAdjustment >= threshold &&
      stockAfterAdjustment < threshold
    ) {
      this.eventBus.publish(
        new StockDroppedBelowThresholdEvent(
          ctx,
          variant,
          stockBeforeAdjustment,
          stockAfterAdjustment
        )
      );
    }
  }

  private getCacheKey(ctx: RequestContext): string {
    return `low-stock-variants-${ctx.channel.id}`;
  }
}
