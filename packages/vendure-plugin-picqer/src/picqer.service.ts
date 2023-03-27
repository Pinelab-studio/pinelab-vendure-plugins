import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  EventBus,
  JobQueueService,
  ID,
  SerializedRequestContext,
  OrderPlacedEvent,
  ProductVariantEvent,
  JobQueue,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { PicqerOptions } from './picqer.plugin';

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
    private jobQueueService: JobQueueService
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
}
