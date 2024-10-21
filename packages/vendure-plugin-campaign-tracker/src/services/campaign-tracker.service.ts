import { Inject, Injectable } from '@nestjs/common';
import {
  ID,
  RequestContext,
  TransactionalConnection,
  PaginatedList,
} from '@vendure/core';
import { CAMPAIGN_TRACKER_PLUGIN_OPTIONS } from '../constants';
import { Campaign } from '../entities/campaign.entity';
import { PluginInitOptions } from '../types';
import { CampaignInput } from '../ui/generated/graphql';

@Injectable()
export class CampaignTrackerService {
  constructor(
    private connection: TransactionalConnection,
    @Inject(CAMPAIGN_TRACKER_PLUGIN_OPTIONS) private options: PluginInitOptions
  ) {}

  async createCampaign(
    ctx: RequestContext,
    input: CampaignInput
  ): Promise<Campaign> {}

  async updateCampaign(
    ctx: RequestContext,
    id: ID,
    input: CampaignInput
  ): Promise<Campaign>;

  async getCampaigns(ctx: RequestContext): Promise<PaginatedList<Campaign>>;

  async addCampaignToOrder(
    ctx: RequestContext,
    campaignCode: string
  ): Promise<void>;
}
