import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  EventBus,
  JobQueueService,
  ID,
  SerializedRequestContext,
  OrderPlacedEvent,
  ProductVariantEvent,
  JobQueue,
  RequestContext,
  TransactionalConnection,
  Logger,
} from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { PicqerOptions } from '../picqer.plugin';
import {
  PicqerConfig,
  PicqerConfigInput,
  TestPicqerInput,
} from '../ui/generated/graphql';
import { PicqerConfigEntity } from './picqer-config.entity';
import { Repository } from 'typeorm';
import { PicqerClient } from './picqer.client';

interface PushVariantsJob {
  action: 'push-variants';
  ctx: SerializedRequestContext;
  variantIds: ID[];
}

type JobData = PushVariantsJob; // TODO | PullStockLevelsJob | PushOrderJob

@Injectable()
export class PicqerService implements OnApplicationBootstrap {
  private jobQueue!: JobQueue<JobData>;

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private options: PicqerOptions,
    private eventBus: EventBus,
    private jobQueueService: JobQueueService,
    private connection: TransactionalConnection
  ) {}

  async onApplicationBootstrap() {
    // Create JobQueue and handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'picqer-sync',
      process: async ({ data, id }) => {},
    });

    // Listen for placed orders
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      // TODO push order sync
    });
    // Listen for Variant changes
    this.eventBus
      .ofType(ProductVariantEvent)
      .subscribe(async ({ ctx, entity, type }) => {
        if (type === 'created' || type === 'updated') {
          await this.jobQueue.add(
            {
              action: 'push-variants',
              ctx: ctx.serialize(),
              variantIds: entity.map((v) => v.id),
            },
            { retries: 10 }
          );
        }
      });
  }

  async upsertConfig(
    ctx: RequestContext,
    input: PicqerConfigInput
  ): Promise<PicqerConfig> {
    const repository = this.connection.getRepository(ctx, PicqerConfigEntity);
    const existing = await repository.findOne({
      channelId: String(ctx.channelId),
    });
    if (existing) {
      (input as Partial<PicqerConfigEntity>).id = existing.id;
    }
    await repository.save({
      ...input,
      channelId: ctx.channelId,
    } as PicqerConfigEntity);
    Logger.info(
      `Picqer config updated for channel ${ctx.channel.token} by user ${ctx.activeUserId}`,
      loggerCtx
    );
    return repository.findOneOrFail({ channelId: String(ctx.channelId) });
  }

  async getConfig(ctx: RequestContext): Promise<PicqerConfig | undefined> {
    const repository = this.connection.getRepository(ctx, PicqerConfigEntity);
    return repository.findOne({ channelId: String(ctx.channelId) });
  }

  async testRequest(input: TestPicqerInput): Promise<boolean> {
    const client = new PicqerClient(input);
    // If getStatus() doesn't throw, the request is valid
    try {
      await client.getStats();
      return true;
    } catch (e) {
      return false;
    }
  }
}
