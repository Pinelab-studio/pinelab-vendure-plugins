import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  Channel,
  EventBus,
  JobQueue,
  JobQueueService,
  Logger,
  ID,
  Product,
  ProductEvent,
  ProductService,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { BETTER_SEARCH_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { BetterSearchIndex } from '../entities/better-search-index.entity';
import { BetterSearchIndexEvent } from '../events/better-search-index.event';
import { BetterSearchOptions, IndexJobData } from '../types';
import { createIndexKey } from './util';

/**
 * Cache TTL for keeping the search index in memory, before fetching it again from the DB
 */
const INDEX_CACHE_TTL = 10_000;

interface PartialIndexChanges {
  productIds?: ID[];
  variantIds?: ID[];
  remove?: boolean;
}

interface PendingPartialUpdate {
  ctx: RequestContext;
  updateProductIds: Set<string>;
  updateVariantIds: Set<string>;
  removeProductIds: Set<string>;
  removeVariantIds: Set<string>;
}

@Injectable()
export class IndexService implements OnModuleInit, OnApplicationBootstrap {
  private jobQueue!: JobQueue<IndexJobData>;

  private pendingPartialUpdates = new Map<string, PendingPartialUpdate>();

  private indexWrites: Promise<unknown> = Promise.resolve();

  private storedIndexSizes?: Map<string, number>;

  /** Logs serialized sizes in MB, loading existing index sizes only once per process. */
  private async logIndexSizes(
    ctx: RequestContext,
    indexKey: string,
    serialized: string
  ): Promise<void> {
    try {
      if (!this.storedIndexSizes) {
        const stored = await this.connection
          .getRepository(ctx, BetterSearchIndex)
          .find({ select: ['id', 'data'] });
        this.storedIndexSizes = new Map(
          stored.map((index) => [
            index.id,
            Buffer.byteLength(index.data, 'utf8'),
          ])
        );
      }
      const bytes = Buffer.byteLength(serialized, 'utf8');
      this.storedIndexSizes.set(indexKey, bytes);
      const total = [...this.storedIndexSizes.values()].reduce(
        (sum, size) => sum + size,
        0
      );
      Logger.info(
        `Index '${indexKey}' size: ${(bytes / 1_000_000).toFixed(
          2
        )} MB; total across ${this.storedIndexSizes.size} stored indexes: ${(
          total / 1_000_000
        ).toFixed(2)} MB (serialized)`,
        loggerCtx
      );
    } catch (e) {
      const error = asError(e);
      Logger.error(
        `Failed to log index sizes for '${indexKey}': ${error.message}`,
        loggerCtx,
        error.stack
      );
    }
  }

  /** Serializes writes in this worker process; rejected writes do not block later jobs. */
  private serializeWrite<T>(write: () => Promise<T>): Promise<T> {
    const result = this.indexWrites.then(write);
    this.indexWrites = result.catch(() => undefined);
    return result;
  }

  /** In-memory cache of deserialized indices plus metadata to check TTL. */
  private cachedIndices = new Map<
    string,
    {
      index: unknown;
      /**
       * The updatedAt timestamp of the index in the database,
       * used to compare in memory cached index with the database index
       */
      updatedAt: Date;
      /**
       * Used to check if we need to check the DB for a newer index,
       * or if we can return the cached index because it was already checked recently.
       */
      lastCheckedAt: number;
    }
  >();

  constructor(
    private connection: TransactionalConnection,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS)
    private options: BetterSearchOptions,
    private jobQueueService: JobQueueService,
    private productService: ProductService,
    private productVariantService: ProductVariantService,
    private eventBus: EventBus
  ) {}

  private get engine() {
    return this.options.searchEngine!;
  }

  onApplicationBootstrap() {
    // Listen for product events
    this.eventBus.ofType(ProductEvent).subscribe((event) => {
      this.reindexAffectedChannels(event.ctx, {
        productIds: [event.entity.id],
        remove: event.type === 'deleted',
      }).catch((e) => {
        const error = asError(e);
        Logger.error(
          `Failed to queue partial index update for ProductEvent (${event.type}, product ${event.entity.id}): ${error.message}`,
          loggerCtx,
          error.stack
        );
      });
    });
    // Listen for variant events
    this.eventBus.ofType(ProductVariantEvent).subscribe((event) => {
      this.reindexAffectedChannels(event.ctx, {
        variantIds: event.entity.map((variant) => variant.id),
        remove: event.type === 'deleted',
      }).catch((e) => {
        const error = asError(e);
        Logger.error(
          `Failed to queue partial index update for ProductVariantEvent (${event.type}): ${error.message}`,
          loggerCtx,
          error.stack
        );
      });
    });

    // Build initial indexes for enabled channels that don't have one yet
    this.buildMissingIndexes().catch((e) => {
      const error = asError(e);
      Logger.error(
        `Failed to build missing indexes: ${error.message}`,
        loggerCtx,
        error.stack
      );
    });
  }

  async onModuleInit(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'better-search-index',
      process: async (job) => {
        const ctx = RequestContext.deserialize(job.data.ctx);
        try {
          const count =
            job.data.type === 'full'
              ? await this.buildIndex(ctx)
              : await this.updateIndex(ctx, job.data);
          return {
            message: `${
              job.data.type === 'full' ? 'Indexing' : 'Partial indexing'
            } of ${count} variants/products completed for channel '${
              ctx.channel.token
            }' (${ctx.languageCode})`,
          };
        } catch (e) {
          const error = asError(e);
          Logger.error(
            `Failed to process ${job.data.type} index job for channel '${ctx.channel.token}' (${ctx.languageCode}): ${error.message}`,
            loggerCtx,
            error.stack
          );
          throw e;
        }
      },
    });
  }

  /**
   * Iterates over all channels and builds an initial search index for each
   * enabled channel that does not yet have an index stored in the database.
   */
  private async buildMissingIndexes(): Promise<void> {
    const channels = await this.connection.rawConnection
      .getRepository(Channel)
      .find();
    for (const channel of channels) {
      const ctx = new RequestContext({
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
        apiType: 'admin',
        channel,
      });
      // Skip if search is disabled for this channel
      if (this.options.isEnabled && !(await this.options.isEnabled(ctx))) {
        Logger.info(
          `Skipping initial index build for channel '${channel.token}' — search is disabled`,
          loggerCtx
        );
        continue;
      }
      for (const languageCode of channel.availableLanguageCodes) {
        const indexKey = createIndexKey(
          new RequestContext({
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
            apiType: 'admin',
            channel,
            languageCode,
          })
        );
        const existing = await this.connection
          .getRepository(ctx, BetterSearchIndex)
          .findOne({ where: { id: indexKey } });
        if (!existing) {
          Logger.info(
            `No index found for channel '${channel.token}' (${languageCode}), triggering initial build`,
            loggerCtx
          );
          const langCtx = new RequestContext({
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
            apiType: 'admin',
            channel,
            languageCode,
          });
          this.triggerReindex(langCtx).catch((e) => {
            const error = asError(e);
            Logger.error(
              `Failed to trigger initial index build for '${indexKey}': ${error.message}`,
              loggerCtx,
              error.stack
            );
          });
        }
      }
    }
  }

  /**
   * Queues a full reindex for every enabled channel and available language.
   */
  async triggerReindexForAllChannels(): Promise<void> {
    const channels = await this.connection.rawConnection
      .getRepository(Channel)
      .find();

    for (const channel of channels) {
      const channelCtx = new RequestContext({
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
        apiType: 'admin',
        channel,
      });
      if (
        this.options.isEnabled &&
        !(await this.options.isEnabled(channelCtx))
      ) {
        Logger.info(
          `Skipping scheduled reindex for channel '${channel.token}' — search is disabled`,
          loggerCtx
        );
        continue;
      }

      for (const languageCode of channel.availableLanguageCodes) {
        const ctx = new RequestContext({
          isAuthorized: true,
          authorizedAsOwnerOnly: false,
          apiType: 'admin',
          channel,
          languageCode,
        });
        await this.triggerReindex(ctx);
      }
    }
  }

  /**
   * Fetches all products, lets the search engine create the index, and saves the index to the database.
   */
  buildIndex(ctx: RequestContext): Promise<number> {
    return this.serializeWrite(() => this.buildIndexInternal(ctx));
  }

  /** Rebuilds all language indexes while holding the worker write lock. */
  private async buildIndexInternal(_ctx: RequestContext): Promise<number> {
    // Skip if search is disabled for this channel
    if (this.options.isEnabled && !(await this.options.isEnabled(_ctx))) {
      throw new Error(
        `Cannot build index: search is disabled for channel '${_ctx.channel.token}' (${_ctx.languageCode}) `
      );
    }
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
      const searchIndex = await this.engine.createIndex(
        ctx,
        allProducts.flatMap((p) => p.variants)
      );
      const indexKey = createIndexKey(ctx);
      const serialized = this.engine.serializeIndex(searchIndex);
      const saved = await this.connection
        .getRepository(ctx, BetterSearchIndex)
        .save({ id: indexKey, data: serialized });
      this.cachedIndices.set(indexKey, {
        index: searchIndex,
        updatedAt: saved.updatedAt,
        lastCheckedAt: Date.now(),
      });
      await this.logIndexSizes(ctx, indexKey, serialized);
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

  /** Updates and persists only the documents affected by a partial index job. */
  updateIndex(
    ctx: RequestContext,
    changes: Extract<IndexJobData, { type: 'partial' }>
  ): Promise<number> {
    return this.serializeWrite(() => this.updateIndexInternal(ctx, changes));
  }

  /** Uses a fresh, isolated index so failed writes cannot corrupt the cache. */
  private async updateIndexInternal(
    ctx: RequestContext,
    changes: Extract<IndexJobData, { type: 'partial' }>
  ): Promise<number> {
    if (this.options.isEnabled && !(await this.options.isEnabled(ctx))) {
      throw new Error(
        `Cannot update index: search is disabled for channel '${ctx.channel.token}' (${ctx.languageCode})`
      );
    }

    const stored = await this.connection
      .getRepository(ctx, BetterSearchIndex)
      .findOne({ where: { id: createIndexKey(ctx) } });
    if (!stored) {
      throw new Error(
        `No index found for channel '${ctx.channel.token}' (${ctx.languageCode})`
      );
    }
    const searchIndex = this.engine.deserializeIndex(stored.data);
    const productIdsToReplace = [
      ...new Set([...changes.updateProductIds, ...changes.removeProductIds]),
    ];
    const variantIdsToReplace = [
      ...new Set([...changes.updateVariantIds, ...changes.removeVariantIds]),
    ];
    const affectedVariantIds = new Set<string>();
    const existingDocuments = await this.engine.getDocuments(
      searchIndex,
      0,
      Number.MAX_SAFE_INTEGER
    );
    for (const document of existingDocuments) {
      if (
        productIdsToReplace.includes(String(document.productId)) ||
        variantIdsToReplace.includes(String(document.id))
      ) {
        affectedVariantIds.add(String(document.id));
      }
    }

    const variants = await this.getVariantsForPartialUpdate(ctx, changes);
    variants.forEach((variant) => affectedVariantIds.add(String(variant.id)));

    const indexWithoutOldDocuments = await this.engine.removeDocuments(
      ctx,
      searchIndex,
      variantIdsToReplace,
      productIdsToReplace
    );
    const updatedIndex = await this.engine.updateDocuments(
      ctx,
      indexWithoutOldDocuments,
      variants
    );
    const indexKey = createIndexKey(ctx);
    const serialized = this.engine.serializeIndex(updatedIndex);
    const saved = await this.connection
      .getRepository(ctx, BetterSearchIndex)
      .save({ id: indexKey, data: serialized });
    this.cachedIndices.set(indexKey, {
      index: updatedIndex,
      updatedAt: saved.updatedAt,
      lastCheckedAt: Date.now(),
    });

    await this.logIndexSizes(ctx, indexKey, serialized);
    await this.eventBus.publish(
      new BetterSearchIndexEvent(ctx, affectedVariantIds.size, 'partial')
    );
    Logger.info(
      `Partially updated ${affectedVariantIds.size} variants in index ${indexKey}`,
      loggerCtx
    );
    return affectedVariantIds.size;
  }

  /** Loads enabled variants and all relations needed by the search engine. */
  private async getVariantsForPartialUpdate(
    ctx: RequestContext,
    changes: Extract<IndexJobData, { type: 'partial' }>
  ): Promise<ProductVariant[]> {
    const variants = new Map<string, ProductVariant>();
    const removedProductIds = new Set(changes.removeProductIds);
    const removedVariantIds = new Set(changes.removeVariantIds);

    for (const productId of changes.updateProductIds) {
      if (removedProductIds.has(productId)) continue;
      const product = await this.productService.findOne(ctx, productId, [
        'translations',
        'channels',
        'facetValues',
        'facetValues.translations',
        'variants',
        'variants.channels',
        'variants.productVariantPrices',
        'variants.taxCategory',
        'variants.collections',
        'variants.collections.translations',
      ]);
      if (
        !product?.enabled ||
        product.deletedAt ||
        !product.channels.some(
          (channel) => String(channel.id) === String(ctx.channelId)
        )
      )
        continue;
      for (const variant of product.variants) {
        if (
          !variant.enabled ||
          variant.deletedAt ||
          !variant.channels.some(
            (channel) => String(channel.id) === String(ctx.channelId)
          ) ||
          removedVariantIds.has(String(variant.id))
        ) {
          continue;
        }
        variant.product = product;
        await this.productVariantService.applyChannelPriceAndTax(variant, ctx);
        variants.set(String(variant.id), variant);
      }
    }

    for (const variantId of changes.updateVariantIds) {
      if (removedVariantIds.has(variantId)) continue;
      const variant = await this.productVariantService.findOne(ctx, variantId, [
        'product',
        'channels',
        'product.channels',
        'product.translations',
        'product.facetValues',
        'product.facetValues.translations',
        'collections',
        'collections.translations',
      ]);
      if (
        !variant?.enabled ||
        variant.deletedAt ||
        !variant.product?.enabled ||
        variant.product.deletedAt ||
        !variant.channels.some(
          (channel) => String(channel.id) === String(ctx.channelId)
        ) ||
        !variant.product.channels.some(
          (channel) => String(channel.id) === String(ctx.channelId)
        ) ||
        removedProductIds.has(String(variant.productId))
      ) {
        continue;
      }
      variants.set(String(variant.id), variant);
    }
    return [...variants.values()];
  }

  /**
   * Gets the index from cache (respecting a 10-second TTL), falling back to
   * the database if the updateAt of de index in DB is newer. If it is not, it keeps the cached in memory index
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
      const deserialized = this.engine.deserializeIndex(fresh.data);
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
      const deserialized = this.engine.deserializeIndex(stored.data);
      this.cachedIndices.set(indexKey, {
        index: deserialized,
        updatedAt: stored.updatedAt,
        lastCheckedAt: Date.now(),
      });
      return deserialized;
    }

    throw new Error(
      `No index found for channel '${ctx.channel.token}' (${ctx.languageCode})`
    );
  }

  /**
   * Creates a job to reindex all products for the given channel for the given language.
   */
  triggerReindex(ctx: RequestContext) {
    return this.jobQueue.add(
      {
        type: 'full',
        ctx: ctx.serialize(),
      },
      { retries: 2 }
    );
  }

  /** Queues a partial update for exactly the serialized context's channel and language. */
  triggerPartialReindex(data: Extract<IndexJobData, { type: 'partial' }>) {
    return this.jobQueue.add(data, { retries: 2 });
  }

  /** Resolves channel assignments, using existing indexes as the deletion fallback. */
  async reindexAffectedChannels(
    ctx: RequestContext,
    changes: PartialIndexChanges
  ): Promise<void> {
    const channels = await this.connection.getRepository(ctx, Channel).find({
      relations: ['defaultTaxZone', 'defaultShippingZone'],
    });
    const assignments = new Map<string, PartialIndexChanges>();
    for (const field of ['productIds', 'variantIds'] as const) {
      for (const id of changes[field] ?? []) {
        const item =
          field === 'productIds'
            ? await this.connection.getRepository(ctx, Product).findOne({
                where: { id },
                relations: ['channels'],
                withDeleted: true,
              })
            : await this.connection.getRepository(ctx, ProductVariant).findOne({
                where: { id },
                relations: ['channels'],
                withDeleted: true,
              });
        const assigned = item?.channels ?? [];
        const targets = assigned.length
          ? assigned
          : changes.remove
          ? channels
          : [];
        for (const channel of targets) {
          const key = String(channel.id);
          const batch = assignments.get(key) ?? { remove: changes.remove };
          (batch[field] ??= []).push(id);
          assignments.set(key, batch);
        }
      }
    }
    for (const channel of channels) {
      const batch = assignments.get(String(channel.id));
      if (!batch) continue;
      const channelCtx = new RequestContext({
        apiType: ctx.apiType,
        channel,
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
      });
      await this.debouncedRebuildIndex(
        channelCtx,
        batch,
        changes.remove === true
      );
    }
  }

  /**
   * Remembers affected IDs and debounces one partial job per channel and language.
   */
  async debouncedRebuildIndex(
    ctx: RequestContext,
    changes: PartialIndexChanges,
    existingIndexesOnly = false
  ): Promise<void> {
    for (const languageCode of ctx.channel.availableLanguageCodes) {
      const languageCtx = new RequestContext({
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
        apiType: ctx.apiType,
        channel: ctx.channel,
        languageCode,
      });
      if (
        this.options.isEnabled &&
        !(await this.options.isEnabled(languageCtx))
      ) {
        continue;
      }
      if (
        existingIndexesOnly &&
        !(await this.connection
          .getRepository(languageCtx, BetterSearchIndex)
          .findOne({ where: { id: createIndexKey(languageCtx) } }))
      )
        continue;
      this.rememberPartialUpdate(languageCtx, changes);
    }
  }

  /** Merges IDs into an existing debounce batch, with removals taking precedence. */
  private rememberPartialUpdate(
    ctx: RequestContext,
    changes: PartialIndexChanges
  ): void {
    const key = createIndexKey(ctx);
    let batch = this.pendingPartialUpdates.get(key);
    if (!batch) {
      batch = {
        ctx,
        updateProductIds: new Set(),
        updateVariantIds: new Set(),
        removeProductIds: new Set(),
        removeVariantIds: new Set(),
      };
      setTimeout(() => {
        this.flushPartialUpdate(key).catch((e) => {
          const error = asError(e);
          Logger.error(
            `Failed to add partial reindex job for '${key}': ${error.message}`,
            loggerCtx,
            error.stack
          );
        });
      }, this.options.debounceIndexRebuildMs);
      this.pendingPartialUpdates.set(key, batch);
    }

    this.mergeIds(
      batch.updateProductIds,
      batch.removeProductIds,
      changes.productIds ?? [],
      changes.remove === true
    );
    this.mergeIds(
      batch.updateVariantIds,
      batch.removeVariantIds,
      changes.variantIds ?? [],
      changes.remove === true
    );
  }

  /** Adds IDs to either updates or removals without allowing updates to revive removals. */
  private mergeIds(
    updates: Set<string>,
    removals: Set<string>,
    ids: ID[],
    remove: boolean
  ): void {
    for (const id of ids.map(String)) {
      if (remove) {
        updates.delete(id);
        removals.add(id);
        continue;
      }
      if (!removals.has(id)) updates.add(id);
    }
  }

  /** Removes a completed debounce batch before submitting it so later IDs use a new batch. */
  private async flushPartialUpdate(key: string): Promise<void> {
    const batch = this.pendingPartialUpdates.get(key);
    if (!batch) return;
    this.pendingPartialUpdates.delete(key);
    await this.triggerPartialReindex({
      type: 'partial',
      ctx: batch.ctx.serialize(),
      updateProductIds: [...batch.updateProductIds],
      updateVariantIds: [...batch.updateVariantIds],
      removeProductIds: [...batch.removeProductIds],
      removeVariantIds: [...batch.removeVariantIds],
    });
  }
}
