import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EventBus,
  JobQueue,
  JobQueueService,
  Logger,
  Product,
  ProductEvent,
  ProductService,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { BETTER_SEARCH_PLUGIN_OPTIONS, engine, loggerCtx } from '../constants';
import { BetterSearchOptions } from '../types';
import { createIndexKey } from './util';
import { BetterSearchIndex } from '../entities/better-search-index.entity';
import {
  BetterSearchIndexEvent,
  BetterSearchIndexType,
} from '../events/better-search-index.event';

/**
 * Cache TTL for keeping the search index in memory, before fetching it again from the DB
 */
const INDEX_CACHE_TTL = 10_000;

@Injectable()
export class IndexService implements OnModuleInit, OnApplicationBootstrap {
  private jobQueue!: JobQueue<{
    ctx: SerializedRequestContext;
  }>;

  private rebuildIndicesQueue = new Map<string, RequestContext>();

  /** In-memory cache of deserialized indices plus metadata to check TTL. */
  private cachedIndices = new Map<
    string,
    { index: unknown; updatedAt: Date; lastCheckedAt: number }
  >();

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
   */
  async buildIndex(_ctx: RequestContext): Promise<number> {
    let productCount = 0;
    for (const languageCode of _ctx.channel.availableLanguageCodes) {
      const ctx = new RequestContext({
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
        apiType: _ctx.apiType,
        channel: _ctx.channel,
        languageCode,
      });
      const start = performance.now();
      Logger.info(
        `Rebuilding index for channel '${ctx.channel.token}' (${languageCode})...`,
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
        allProducts.flatMap((p) => p.variants)
      );
      const indexKey = createIndexKey(ctx);
      const serialized = engine.serializeIndex(searchIndex);
      const saved = await this.connection
        .getRepository(ctx, BetterSearchIndex)
        .save({ id: indexKey, data: serialized });
      this.cachedIndices.set(indexKey, {
        index: searchIndex,
        updatedAt: saved.updatedAt,
        lastCheckedAt: Date.now(),
      });
      const time = Math.round(performance.now() - start);
      Logger.info(
        `Created index for ${indexKey} with ${allProducts.length} products in ${time}ms`,
        loggerCtx
      );
      this.eventBus
        .publish(new BetterSearchIndexEvent(ctx, allProducts.length, 'full'))
        .catch((e) => {
          const error = asError(e);
          Logger.error(
            `Failed to publish BetterSearchIndexEvent: ${error.message}`,
            loggerCtx,
            error.stack
          );
        });
      productCount = allProducts.length;
    }
    return productCount;
  }

  /**
   * Gets the index from cache (respecting a 10-second TTL), falling back to
   * the database, and finally rebuilding in-memory if neither has it.
   *
   * @param ignoreCacheTtl When true, always return the cached index without
   *   checking whether the DB record has been updated.
   */
  async getIndex(
    ctx: RequestContext,
    ignoreCacheTtl = false
  ): Promise<unknown> {
    const indexKey = createIndexKey(ctx);
    const cached = this.cachedIndices.get(indexKey);

    // 1. Cache hit with valid TTL
    const ttlValid =
      cached &&
      (ignoreCacheTtl || Date.now() - cached.lastCheckedAt < INDEX_CACHE_TTL);
    if (ttlValid) {
      return cached.index;
    }

    // 2. Cache hit but TTL expired — check DB updatedAt
    if (cached) {
      const stored = await this.connection
        .getRepository(ctx, BetterSearchIndex)
        .findOne({
          select: ['updatedAt'],
          where: { id: indexKey },
        });
      const dbIsNewer = stored && stored.updatedAt > cached.updatedAt;
      if (!dbIsNewer) {
        cached.lastCheckedAt = Date.now();
        return cached.index;
      }
      const fresh = await this.connection
        .getRepository(ctx, BetterSearchIndex)
        .findOne({ where: { id: indexKey } });
      if (!fresh) {
        cached.lastCheckedAt = Date.now();
        return cached.index;
      }
      const deserialized = engine.deserializeIndex(fresh.data);
      this.cachedIndices.set(indexKey, {
        index: deserialized,
        updatedAt: fresh.updatedAt,
        lastCheckedAt: Date.now(),
      });
      return deserialized;
    }

    // 3. No cache — load full record from DB
    const stored = await this.connection
      .getRepository(ctx, BetterSearchIndex)
      .findOne({ where: { id: indexKey } });
    if (stored) {
      const deserialized = engine.deserializeIndex(stored.data);
      this.cachedIndices.set(indexKey, {
        index: deserialized,
        updatedAt: stored.updatedAt,
        lastCheckedAt: Date.now(),
      });
      return deserialized;
    }

    // 4. Nothing in DB — build fresh
    Logger.info(
      `No index found for '${indexKey}' in cache or database, building new index...`,
      loggerCtx
    );
    await this.buildIndex(ctx);
    const rebuilt = this.cachedIndices.get(indexKey);
    if (!rebuilt) {
      throw new Error(`Index not found for ${indexKey}`);
    }
    return rebuilt.index;
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
  async debouncedRebuildIndex(ctx: RequestContext) {
    const key = createIndexKey(ctx);
    this.rebuildIndicesQueue.set(key, ctx);
    // Wait for debounce time, so that more rebuilds can be added to the rebuild queue and are deduplicated
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
