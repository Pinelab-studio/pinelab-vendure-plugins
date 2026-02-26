import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EventBus,
  Injector,
  JobQueue,
  JobQueueService,
  Logger,
  Product,
  ProductEvent,
  ProductService,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { BETTER_SEARCH_PLUGIN_OPTIONS, engine, loggerCtx } from '../constants';
import { BetterSearchOptions } from '../types';

@Injectable()
export class IndexService implements OnModuleInit, OnApplicationBootstrap {
  private jobQueue!: JobQueue<{
    ctx: SerializedRequestContext;
  }>;

  private rebuildIndicesQueue = new Map<string, RequestContext>();

  private cachedIndices = new Map<string, unknown>();

  constructor(
    private connection: TransactionalConnection,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS)
    private options: BetterSearchOptions,
    private jobQueueService: JobQueueService,
    private productService: ProductService,
    private productVariantService: ProductVariantService,
    private eventBus: EventBus,
    private moduleRef: ModuleRef
  ) {}

  onApplicationBootstrap() {
    // Listen for product events
    this.eventBus.ofType(ProductEvent).subscribe((event) => {
      this.debouncedRebuildIndex(event.ctx).catch((e) => {
        const error = asError(e);
        Logger.error(
          `Failed to rebuild index for ProductEvent (${event.type}): ${error.message}`,
          loggerCtx,
          error.stack
        );
      });
    });
    // Listen for variant events
    this.eventBus.ofType(ProductVariantEvent).subscribe((event) => {
      this.debouncedRebuildIndex(event.ctx).catch((e) => {
        const error = asError(e);
        Logger.error(
          `Failed to rebuild index for ProductVariantEvent (${event.type}): ${error.message}`,
          loggerCtx,
          error.stack
        );
      });
    });
  }

  async onModuleInit(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'better-search-index',
      process: async (job) => {
        const ctx = RequestContext.deserialize(job.data.ctx);
        try {
          const count = await this.buildIndex(ctx);
          return {
            message: `Indexing of ${count} products completed for channel '${ctx.channel.token}' (${ctx.languageCode})`,
          };
        } catch (e) {
          const error = asError(e);
          Logger.error(
            `Failed to build index for channel '${ctx.channel.token} (${ctx.languageCode})': ${error.message}`,
            loggerCtx,
            error.stack
          );
          throw e;
        }
      },
    });
  }

  /**
   * Fetches all products, let the search engine create the index, and saves the index to the database.
   * Saves the index to the database.
   */
  async buildIndex(ctx: RequestContext): Promise<number> {
    const start = performance.now();
    Logger.info(
      `Rebuilding index for channel '${ctx.channel.token} (${ctx.languageCode})'...`,
      loggerCtx
    );
    // Get all products
    let skip = 0;
    const take = 100;
    const allProducts: Product[] = [];
    let hasMore = true;
    while (hasMore) {
      const { items: products } = await this.productService.findAll(
        ctx,
        {
          skip,
          take,
          filter: {
            deletedAt: {
              isNull: true,
            },
            enabled: {
              eq: true,
            },
          },
        },
        // FIXME we might need to optimize this, instead of too many joins
        ['featuredAsset', 'facetValues.translations', 'variants.collections']
      );
      skip += take;
      if (products.length < take) {
        hasMore = false;
      }
      // Set all products on the variant object as well
      products.forEach((p) => {
        p.variants.forEach((v) => {
          v.product = p;
        });
      });
      allProducts.push(...products);
    }
    const searchIndex = await engine.createIndex(
      ctx,
      allProducts.flatMap((p) => p.variants as ProductVariant[])
    );
    this.cachedIndices.set(
      `${ctx.channel.token}-${ctx.languageCode}`,
      searchIndex
    );
    return allProducts.length;
  }

  getIndex(ctx: RequestContext): undefined | unknown {
    return this.cachedIndices.get(`${ctx.channel.token}-${ctx.languageCode}`);
  }

  /**
   * Creates a job to reindex all products for the given channel for the given language.
   */
  triggerReindex(ctx: RequestContext) {
    return this.jobQueue.add({
      ctx: ctx.serialize(),
    });
  }

  /**
   * Adds index rebuild to the queue, and waits for more events to come in before triggering an index rebuild, for improved performance.
   */
  private async debouncedRebuildIndex(ctx: RequestContext) {
    const key = `${ctx.channel.token}-${ctx.languageCode}`;
    this.rebuildIndicesQueue.set(key, ctx);
    // Wait for debounce time, so that more rebuilds can be added to the rebuild queue
    await new Promise((resolve) =>
      setTimeout(resolve, this.options.debounceIndexRebuildMs)
    );
    // Trigger rebuild for all channels in the queue
    this.rebuildIndicesQueue.forEach((ctx) => {
      this.triggerReindex(ctx).catch((e) => {
        const error = asError(e);
        Logger.error(
          `Failed to add reindex job to the job queue for '${key}': ${error.message}`,
          loggerCtx,
          error.stack
        );
      });
    });
    // Clear queue, because we have triggered rebuilds for all channels in the queue
    this.rebuildIndicesQueue.clear();
  }
}
