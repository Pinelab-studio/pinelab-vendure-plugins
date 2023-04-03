import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  EventBus,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  OrderPlacedEvent,
  Product,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import { PicqerOptions } from '../picqer.plugin';
import {
  PicqerConfig,
  PicqerConfigInput,
  TestPicqerInput,
} from '../ui/generated/graphql';
import { PicqerConfigEntity } from './picqer-config.entity';
import { PicqerClient, PicqerClientInput } from './picqer.client';
import { ProductInput } from './types';

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
    private connection: TransactionalConnection,
    private variantService: ProductVariantService
  ) {}

  async onApplicationBootstrap() {
    // Create JobQueue and handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'picqer-sync',
      process: async ({ data, id }) => {
        const ctx = RequestContext.deserialize(data.ctx);
        if (data.action === 'push-variants') {
          await this.pushVariantsToPicqer(ctx, data.variantIds);
        } else {
          Logger.error(`Invalid job action: ${data.action}`, loggerCtx);
        }
      },
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

  async triggerFullSync(ctx: RequestContext): Promise<boolean> {
    const variantIds: ID[] = [];
    let skip = 0;
    const take = 1000;
    let hasMore = true;
    while (hasMore) {
      const [variants, count] = await this.connection
        .getRepository(ctx, ProductVariant)
        .createQueryBuilder('variant')
        .select(['variant.id'])
        .leftJoin('variant.channels', 'channel')
        .leftJoin('variant.product', 'product')
        .where('channel.id = :channelId', { channelId: ctx.channelId })
        .andWhere('variant.deletedAt IS NULL')
        .andWhere('variant.enabled = true')
        .andWhere('product.deletedAt IS NULL')
        .andWhere('product.enabled is true')
        .skip(skip)
        .take(take)
        .getManyAndCount();
      variantIds.push(...variants.map((v) => v.id));
      if (variantIds.length >= count) {
        hasMore = false;
      }
      skip += take;
    }
    const totalVariants = variantIds.length;
    // Create batches of 10
    while (variantIds.length) {
      await this.jobQueue.add(
        {
          action: 'push-variants',
          ctx: ctx.serialize(),
          variantIds: variantIds.splice(0, 10),
        },
        { retries: 5 }
      );
    }
    Logger.info(
      `Pushed ${totalVariants} variants to the job queue for channel ${ctx.channel.token} by user ${ctx.activeUserId}`,
      loggerCtx
    );
    return true;
  }

  async pushVariantsToPicqer(
    ctx: RequestContext,
    variantIds: ID[]
  ): Promise<void> {
    const client = await this.getClient(ctx);
    if (!client) {
      return;
    }
    const vatGroups = await client.getVatGroups();
    const variants = await this.variantService.findByIds(ctx, variantIds);
    await Promise.all(
      variants.map(async (variant) => {
        const vatGroup = vatGroups.find(
          (vg) => vg.percentage === variant.taxRateApplied.value
        );
        if (!vatGroup) {
          Logger.error(
            `Could not find vatGroup for taxRate ${variant.taxRateApplied.value} for variant ${variant.sku}. Not pushing this variant to Picqer`,
            loggerCtx
          );
          return;
        }
        try {
          const existing = await client.getProductByCode(variant.sku);
          const productInput = this.mapToProductInput(
            variant,
            vatGroup.idvatgroup
          );
          if (existing?.idproduct) {
            await client.updateProduct(existing.idproduct, productInput);
            return Logger.info(
              `Updated variant ${variant.sku} in Picqer (Picqer id: ${existing.idproduct}) for channel ${ctx.channel.token}`,
              loggerCtx
            );
          }
          // Create new variant if no product exists in Picqer
          const created = await client.createProduct(productInput);
          Logger.info(
            `Created  variant ${variant.sku} in Picqer (Picqer id: ${created.idproduct}) for channel ${ctx.channel.token}`,
            loggerCtx
          );
        } catch (e: any) {
          // Only log a warning, because this is a background function that will be retried by the JobQueue
          Logger.warn(
            `Error pushing variant ${variant.sku} to Picqer: ${e?.message}`,
            loggerCtx
          );
          throw e;
        }
      })
    );
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

  /**
   * Get a Picqer client for the current channel if the config is complete and enabled.
   */
  async getClient(ctx: RequestContext): Promise<PicqerClient | undefined> {
    const config = await this.getConfig(ctx);
    if (!config || !config.enabled) {
      Logger.info(
        `Picqer is not enabled for channel ${ctx.channel.token}`,
        loggerCtx
      );
      return;
    }
    if (
      !config.apiKey ||
      !config.apiEndpoint ||
      !config.storefrontUrl ||
      !config.supportEmail
    ) {
      Logger.warn(
        `Picqer config is incomplete for channel ${ctx.channel.token}`,
        loggerCtx
      );
      return;
    }
    return new PicqerClient(config as PicqerClientInput);
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

  private mapToProductInput(
    variant: ProductVariant,
    vatGroupId: number
  ): ProductInput {
    return {
      idvatgroup: vatGroupId,
      name: variant.name,
      price: variant.price,
      productcode: variant.sku,
    };
  }
}
