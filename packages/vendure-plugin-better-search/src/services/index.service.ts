import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ID,
  JobQueue,
  JobQueueService,
  Product,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import MiniSearch from 'minisearch';
import { BETTER_SEARCH_PLUGIN_OPTIONS } from '../constants';
import { PluginInitOptions } from '../types';

@Injectable()
export class IndexService implements OnModuleInit {
  private jobQueue: JobQueue<{
    ctx: SerializedRequestContext;
    someArg: string;
  }>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS) private options: PluginInitOptions,
    private jobQueueService: JobQueueService
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'better-search-index',
      process: async (job) => {
        const ctx = RequestContext.deserialize(job.data.ctx);
        await this.buildIndex(ctx);
        return {
          processedCount: 1,
          message: 'Indexation completed',
        };
      },
    });
  }

  /**
   * Builds the index for all products for the given channel for the given language.
   * Saves the index to the database.
   */
  async buildIndex(ctx: RequestContext): Promise<MiniSearch> {
    // Get all products
    // Create miniSearch
    // Persist index in DB
    return new MiniSearch({
      fields: ['name', 'slug', 'keywords'],
      storeFields: ['id', 'name', 'slug', 'keywords', 'variants'],
      searchOptions: {
        boost: { name: 2, slug: 1, keywords: 2 },
        fuzzy: 0.3,
        prefix: true,
      },
    });
  }

  async getIndex(ctx: RequestContext): Promise<MiniSearch | undefined> {
    return undefined;
  }

  /**
   * Creates a job to reindex all products for the given channel for the given language.
   */
  triggerReindex(ctx: RequestContext) {
    return this.betterSearchIndexQueue.add({
      ctx: ctx.serialize(),
      someArg: 'foo',
    });
  }
}
