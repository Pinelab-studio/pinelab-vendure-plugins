import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  CollectionService,
  EventBus,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  ProductEvent,
  ProductService,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
  Translated,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import MiniSearch from 'minisearch';
import { BETTER_SEARCH_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { BetterSearchDocuments } from '../entities/better-search-documents.entity';
import { BetterSearchConfig } from '../types';
import { tokenize } from './util';
import { BetterSearchResult } from '../api/generated/graphql';

@Injectable()
export class IndexService implements OnModuleInit, OnApplicationBootstrap {
  private jobQueue!: JobQueue<{
    ctx: SerializedRequestContext;
  }>;

  private rebuildIndicesQueue = new Map<string, RequestContext>();

  constructor(
    private connection: TransactionalConnection,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS)
    private options: BetterSearchConfig,
    private jobQueueService: JobQueueService,
    private productService: ProductService,
    private productVariantService: ProductVariantService,
    private eventBus: EventBus,
    private collectionService: CollectionService
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
          const index = await this.buildIndex(ctx);
          return {
            processedCount: index.documentCount,
            message: 'Indexation completed',
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
   * Builds the index for all products for the given channel for the given language.
   * Saves the index to the database.
   */
  async buildIndex(ctx: RequestContext): Promise<MiniSearch> {
    const start = performance.now();
    Logger.info(
      `Rebuilding index for channel '${ctx.channel.token} (${ctx.languageCode})'...`,
      loggerCtx
    );
    // Get all products
    let skip = 0;
    const take = 100;
    const searchDocuments: BetterSearchResult[] = [];
    let hasMore = true;
    while (hasMore) {
      Logger.verbose(
        `Fetching products from ${skip} to ${skip + take} for '${
          ctx.channel.token
        } (${ctx.languageCode})'`,
        loggerCtx
      );
      const { items: products } = await this.productService.findAll(
        ctx,
        {
          skip: skip,
          take: take,
          filter: {
            deletedAt: {
              isNull: true,
            },
            enabled: {
              eq: true,
            },
          },
        },
        ['featuredAsset', 'facetValues.translations']
      );
      skip += take;
      if (products.length < take) {
        hasMore = false;
      }
      // Build search documents for these products
      const indexableProducts: BetterSearchResult[] = await Promise.all(
        products.map(async (p) => {
          const collections =
            await this.collectionService.getCollectionsByProductId(
              ctx,
              p.id,
              true
            );
          // Get variants
          p.variants = await this.getAllVariantsForProduct(ctx, p.id);
          return {
            id: p.id,
            ...this.options.mapToSearchDocument(p, collections),
          };
        })
      );
      searchDocuments.push(...indexableProducts);
    }
    const minisearch = this.createMiniSearch(searchDocuments);
    // Persist index in DB
    await this.connection.getRepository(ctx, BetterSearchDocuments).save({
      id: `${ctx.channel.token}-${ctx.languageCode}`,
      data: JSON.stringify(searchDocuments),
    });
    const durationInS = Math.round((performance.now() - start) / 1000);
    Logger.info(
      `Index built for channel '${ctx.channel.token} (${ctx.languageCode})' in ${durationInS}s: Indexed ${minisearch.documentCount} products.`,
      loggerCtx
    );
    return minisearch;
  }

  async getIndex(ctx: RequestContext): Promise<MiniSearch | undefined> {
    const searchDocuments = await this.connection
      .getRepository(ctx, BetterSearchDocuments)
      .findOne({
        where: {
          id: `${ctx.channel.token}-${ctx.languageCode}`,
        },
      });
    if (!searchDocuments) {
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.createMiniSearch(JSON.parse(searchDocuments.data));
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
   * Instantiates a new MiniSearch instance (index) with the given settings for the given indexable products.
   */
  private createMiniSearch(documents: BetterSearchResult[]) {
    const uniqueFieldNames = [
      ...new Set(documents.flatMap((p) => Object.keys(p))),
    ];
    const minisearch = new MiniSearch({
      // Use suffix terms when indexing
      tokenize: (term) => tokenize(term, 4),
      fields: Object.keys(this.options.indexableFields),
      storeFields: Array.from(uniqueFieldNames),
      searchOptions: {
        // Map the config to, for example,  "{ myFieldName: 3}"
        boost: Object.fromEntries(
          Object.entries(this.options.indexableFields).map(([key, value]) => [
            key,
            value.weight,
          ])
        ),
        fuzzy: this.options.fuzziness,
        prefix: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Use default processTerm when searching
        processTerm: MiniSearch.getDefault('processTerm'),
      },
    });
    // Add all indexable products to the index
    minisearch.addAll(documents);
    return minisearch;
  }

  /**
   * Adds index rebuild to the queue, and waits for more events to come in before triggering an index rebuild.
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

  private async getAllVariantsForProduct(
    ctx: RequestContext,
    productId: ID
  ): Promise<Translated<ProductVariant>[]> {
    const variants: ProductVariant[] = [];
    let skip = 0;
    const take = 50;
    let hasMore = true;
    while (hasMore) {
      const result = await this.productVariantService.getVariantsByProductId(
        ctx,
        productId,
        {
          take,
          skip,
        }
      );
      variants.push(...result.items);
      hasMore = result.items.length === take;
      skip += take;
    }
    return variants as Translated<ProductVariant>[];
  }
}
