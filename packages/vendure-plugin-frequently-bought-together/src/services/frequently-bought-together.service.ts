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
import { FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS } from '../constants';
import { PluginInitOptions } from '../types';

@Injectable()
export class FrequentlyBoughtTogetherService implements OnModuleInit {
  private jobQueue!: JobQueue<{
    ctx: SerializedRequestContext;
    someArg: string;
  }>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS)
    private options: PluginInitOptions,
    private jobQueueService: JobQueueService
  ) {}

  public async onModuleInit(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'frequently-bought-together-calculation',
      process: async () => {
        // TODO
      },
    });
  }

  async exampleMethod(ctx: RequestContext, id: ID) {
    // Add your method logic here
    const result = await this.connection
      .getRepository(ctx, Product)
      .findOne({ where: { id } });
    return result;
  }

  /**
   * Create a job to calculate frequently bought together products
   */
  async triggerCalculation(): Promise<void> {}
}
