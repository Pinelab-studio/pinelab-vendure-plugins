import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, RequestContext, Transaction } from '@vendure/core';
import { CampaignTrackerService } from '../services/campaign-tracker.service';
import {
  Campaign,
  CampaignList,
  MutationCreateCampaignArgs,
  MutationDeleteCampaignArgs,
  MutationUpdateCampaignArgs,
  QueryCampaignsArgs,
} from '../ui/generated/graphql';

@Resolver()
export class CampaignTrackerAdminResolver {
  constructor(private campaignTrackerService: CampaignTrackerService) {}

  @Query()
  @Allow(Permission.SuperAdmin)
  async campaigns(
    @Ctx() ctx: RequestContext,
    @Args() { options }: QueryCampaignsArgs
  ): Promise<CampaignList> {
    return await this.campaignTrackerService.getCampaigns(
      ctx,
      options ?? undefined
    );
  }

  @Mutation()
  @Transaction()
  @Allow(Permission.SuperAdmin)
  async createCampaign(
    @Ctx() ctx: RequestContext,
    @Args() { input }: MutationCreateCampaignArgs
  ): Promise<Campaign> {
    return await this.campaignTrackerService.createCampaign(ctx, input);
  }

  @Mutation()
  @Transaction()
  @Allow(Permission.SuperAdmin)
  async updateCampaign(
    @Ctx() ctx: RequestContext,
    @Args() { id, input }: MutationUpdateCampaignArgs
  ): Promise<Campaign> {
    return await this.campaignTrackerService.updateCampaign(ctx, id, input);
  }

  @Mutation()
  @Transaction()
  @Allow(Permission.SuperAdmin)
  async deleteCampaign(
    @Ctx() ctx: RequestContext,
    @Args() { id }: MutationDeleteCampaignArgs
  ): Promise<boolean> {
    await this.campaignTrackerService.deleteCampaign(ctx, id);
    return true;
  }
}
