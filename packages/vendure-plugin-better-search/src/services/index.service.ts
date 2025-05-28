import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  Channel,
  CollectionService,
  JobQueue,
  JobQueueService,
  Logger,
  Product,
  ProductService,
  RequestContext,
  RequestContextService,
  SerializedRequestContext,
  TransactionalConnection,
  translateEntity,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import MiniSearch from 'minisearch';
import { BETTER_SEARCH_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { PluginInitOptions } from '../types';
import { suffixes } from './util';

@Injectable()
export class IndexService implements OnModuleInit, OnApplicationBootstrap {
  private jobQueue!: JobQueue<{
    ctx: SerializedRequestContext;
  }>;

  constructor(
    private connection: TransactionalConnection,
    private requestContextService: RequestContextService,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS) private options: PluginInitOptions,
    private jobQueueService: JobQueueService,
    private productService: ProductService,
    private collectionService: CollectionService
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
            `Failed to build index for channel '${ctx.channel.token}' (${ctx.languageCode}): ${error.message}`,
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
    const channels = await this.connection.rawConnection
      .getRepository(Channel)
      .find();
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
      `Building index for channel '${ctx.channel.token}' (${ctx.languageCode})...`,
      loggerCtx
    );
    // Get all products
    let skipProducts = 0;
    const takeProducts = 99;
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
          'facetValues',
          'variants',
          'variants.collections',
          'variants.collections.translations',
          'variants.facetValues',
        ]
      );
      skipProducts += takeProducts;
      allProducts.push(...items);
      if (items.length <= takeProducts) {
        hasMoreProducts = false;
      }
    }
    const indexableProducts = allProducts.map((p) => {
      let collections = [...new Set(p.variants.flatMap((v) => v.collections))];
      // Translate collections
      collections = collections.map((c) =>
        translateEntity(c, ctx.languageCode)
      );
      // Translate variants
      p.variants = p.variants.map((v) => translateEntity(v, ctx.languageCode));
      return {
        id: p.id,
        ...this.options.mapToSearchDocument(p, collections),
      };
    });
    // Get all unique field names
    const uniqueFieldNames = [
      ...new Set(indexableProducts.flatMap((p) => Object.keys(p))),
    ];
    const minisearch = new MiniSearch({
      // Use suffix terms when indexing
      processTerm: (term) => suffixes(term, 3),
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
    minisearch.addAll(indexableProducts);

    // TODO persist in DB

    const duration = Math.round(performance.now() - start);
    Logger.info(
      `Index built for channel '${ctx.channel.token}' (${ctx.languageCode}) in ${duration}ms: Indexed ${minisearch.documentCount} products.`,
      loggerCtx
    );
    return minisearch;
  }

  async getIndex(ctx: RequestContext): Promise<MiniSearch | undefined> {
    // FIXME
    return this.buildIndex(ctx);
  }

  /**
   * Creates a job to reindex all products for the given channel for the given language.
   */
  triggerReindex(ctx: RequestContext) {
    return this.jobQueue.add({
      ctx: ctx.serialize(),
    });
  }
}
