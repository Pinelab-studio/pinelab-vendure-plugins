import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { JobState } from '@vendure/common/lib/generated-types';
import {
  ID,
  JobQueue,
  JobQueueService,
  PaginatedList,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { CAMPAIGN_TRACKER_PLUGIN_OPTIONS } from '../constants';
import { Campaign } from '../entities/campaign.entity';
import { PluginInitOptions } from '../types';
import { CampaignInput } from '../ui/generated/graphql';

@Injectable()
export class CampaignTrackerService implements OnModuleInit {
  private calculateCampaignMetricsQueue: JobQueue<{
    ctx: SerializedRequestContext;
    someArg: string;
  }>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(CAMPAIGN_TRACKER_PLUGIN_OPTIONS) private options: PluginInitOptions,
    private jobQueueService: JobQueueService
  ) {}

  public async onModuleInit(): Promise<void> {
    this.calculateCampaignMetricsQueue = await this.jobQueueService.createQueue(
      {
        name: 'calculate-campaign-metrics',
        process: async (job) => {
          // Deserialize the RequestContext from the job data
          const ctx = RequestContext.deserialize(job.data.ctx);
          // The "someArg" property is passed in when the job is triggered
          const someArg = job.data.someArg;

          // Inside the `process` function we define how each job
          // in the queue will be processed.
          // Let's simulate some long-running task
          const totalItems = 10;
          for (let i = 0; i < totalItems; i++) {
            await new Promise((resolve) => setTimeout(resolve, 500));

            // You can optionally respond to the job being cancelled
            // during processing. This can be useful for very long-running
            // tasks which can be cancelled by the user.
            if (job.state === JobState.CANCELLED) {
              throw new Error('Job was cancelled');
            }

            // Progress can be reported as a percentage like this
            job.setProgress(Math.floor((i / totalItems) * 100));
          }

          // The value returned from the `process` function is stored
          // as the "result" field of the job
          return {
            processedCount: totalItems,
            message: `Successfully processed ${totalItems} items`,
          };
        },
      }
    );
  }

  async createCampaign(
    ctx: RequestContext,
    input: CampaignInput
  ): Promise<Campaign> {}

  public triggerCalculateCampaignMetrics(ctx: RequestContext) {
    return this.calculateCampaignMetricsQueue.add({
      ctx: ctx.serialize(),
      someArg: 'foo',
    });
  }

  async updateCampaign(
    ctx: RequestContext,
    id: ID,
    input: CampaignInput
  ): Promise<Campaign>;

  async getCampaigns(ctx: RequestContext): Promise<PaginatedList<Campaign>>;

  async addCampaignToOrder(
    ctx: RequestContext,
    campaignCode: string
  ): Promise<Order>;

  /**
   * Calculate metrics for all campaigns of a given channel
   */
  async calculateMetrics(ctx: RequestContext): Promise<void>;
}
