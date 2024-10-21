import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

interface JobData {
  ctx: SerializedRequestContext;
}

@Injectable()
export class CampaignTrackerService implements OnModuleInit {
  private jobQueue!: JobQueue<JobData>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(CAMPAIGN_TRACKER_PLUGIN_OPTIONS) private options: PluginInitOptions,
    private jobQueueService: JobQueueService
  ) {}

  public async onModuleInit(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'campaign-tracker',
      process: (job) => {
        this.calculateCampaignMetrics(
          RequestContext.deserialize(job.data.ctx)
        ).catch((err) => {
          Logger.warn(`Error in calculateCampaignMetrics: ${err?.message}`);
        });
      },
    });
  }

  async createCampaign(
    ctx: RequestContext,
    input: CampaignInput
  ): Promise<Campaign> {}

  async triggerCalculateCampaignMetrics(ctx: RequestContext): Promise<void> {
    await this.jobQueue.add({
      ctx: ctx.serialize(),
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
