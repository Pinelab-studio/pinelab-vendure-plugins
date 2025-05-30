import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  EventBus,
  JobQueue,
  JobQueueService,
  Logger,
  Product,
  ProductEvent,
  ProductService,
  ProductVariantEvent,
  RequestContext,
  RequestContextService,
  SerializedRequestContext,
  TransactionalConnection,
  translateDeep,
  translateEntity,
  ProductPriceApplicator,
  ChannelService,
  ConfigService,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import MiniSearch from 'minisearch';
import { BETTER_SEARCH_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { BetterSearchDocuments } from '../entities/better-search-documents.entity';
import { PluginInitOptions, SearchDocument } from '../types';
import { tokenize } from './util';

@Injectable()
export class IndexService implements OnModuleInit, OnApplicationBootstrap {
  private jobQueue!: JobQueue<{
    ctx: SerializedRequestContext;
  }>;

  private rebuildIndicesQueue = new Map<string, RequestContext>();

  constructor(
    private connection: TransactionalConnection,
    private requestContextService: RequestContextService,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS) private options: PluginInitOptions,
    private jobQueueService: JobQueueService,
    private productService: ProductService,
    private productPriceApplicator: ProductPriceApplicator,
    private eventBus: EventBus,
    private channelService: ChannelService,
    private configService: ConfigService
  ) {}

  onApplicationBootstrap() {
    this.triggerBuildsForAllIndices().catch((e) => {
      const error = asError(e);
      Logger.error(
        `Failed to build indices for all channels: ${error.message}`,
        loggerCtx,
        error.stack
      );
    });
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
   * Triggers index builds for all channels for all languages.
   */
  async triggerBuildsForAllIndices() {
    const ctx = await this.requestContextService.create({
      apiType: 'admin',
    });
    const { items: channels } = await this.channelService.findAll(ctx);
    for (const channel of channels) {
      for (const languageCode of channel.availableLanguageCodes) {
        const ctx = await this.requestContextService.create({
          apiType: 'admin',
          channelOrToken: channel,
          languageCode,
        });
        await this.triggerReindex(ctx);
      }
    }
  }

  /**
   * Builds the index for all products for the given channel for the given language.
   * Saves the index to the database.
   */
  async buildIndex(ctx: RequestContext): Promise<MiniSearch> {
    const start = performance.now();
    Logger.info(
      `Building index for channel '${ctx.channel.token} (${ctx.languageCode})'...`,
      loggerCtx
    );
    // Get all products
    let skipProducts = 0;
    const takeProducts = this.configService.apiOptions.adminListQueryLimit;
    const allProducts: Product[] = [];
    let hasMoreProducts = true;
    while (hasMoreProducts) {
      const { items } = await this.productService.findAll(
        ctx,
        {
          skip: skipProducts,
          take: takeProducts,
          filter: {
            deletedAt: {
              isNull: true,
            },
          },
        },
        [
          'featuredAsset',
          'facetValues.translations',
          'variants.collections.translations',
          'variants.facetValues.translations',
          'variants.productVariantPrices',
          'variants.taxCategory',
        ]
      );
      skipProducts += takeProducts;
      allProducts.push(...items);
      if (items.length < takeProducts) {
        hasMoreProducts = false;
      }
    }
    const indexableProducts: SearchDocument[] = await Promise.all(
      allProducts.map(async (p) => {
        let collections = [
          ...new Set(p.variants.flatMap((v) => v.collections)),
        ];
        // Translate collections
        collections = collections.map((c) =>
          translateEntity(c, ctx.languageCode)
        );
        // Apply prices
        p.variants = await Promise.all(
          p.variants.map((v) =>
            this.productPriceApplicator.applyChannelPriceAndTax(v, ctx)
          )
        );
        // Translate variants
        p.variants = p.variants.map((v) => translateDeep(v, ctx.languageCode));
        return {
          id: p.id,
          ...this.options.mapToSearchDocument(p, collections),
        };
      })
    );
    const minisearch = this.createMiniSearch(indexableProducts);
    // Persist index in DB
    await this.connection.getRepository(ctx, BetterSearchDocuments).save({
      id: `${ctx.channel.token}-${ctx.languageCode}`,
      data: JSON.stringify(indexableProducts),
    });
    // Measure size of the index
    const serializedIndex = minisearch.toJSON();
    const indexSizeInKb = Math.round(
      Buffer.byteLength(JSON.stringify(serializedIndex), 'utf-8') / 1024
    );
    const duration = Math.round(performance.now() - start);
    Logger.info(
      `Index built for channel '${ctx.channel.token} (${ctx.languageCode})' in ${duration}ms: Indexed ${minisearch.documentCount} products. Approximated index size: ${indexSizeInKb} KB.`,
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
  private createMiniSearch(documents: SearchDocument[]) {
    const uniqueFieldNames = [
      ...new Set(documents.flatMap((p) => Object.keys(p))),
    ];
    const minisearch = new MiniSearch({
      // Use suffix terms when indexing
      processTerm: (term) => tokenize(term, 3),
      fields: Object.keys(this.options.indexableFields),
      storeFields: Array.from(uniqueFieldNames),
      searchOptions: {
        boost: this.options.indexableFields,
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
}
