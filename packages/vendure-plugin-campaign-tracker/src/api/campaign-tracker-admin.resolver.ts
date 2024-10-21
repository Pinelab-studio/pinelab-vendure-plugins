import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { ID } from '@vendure/common/lib/shared-types';
import { Allow, Ctx, RequestContext, Transaction } from '@vendure/core';
import { CampaignTrackerService } from '../services/campaign-tracker.service';
import { Campaign, MutationCreateCampaignArgs } from '../ui/generated/graphql';

@Resolver()
export class CampaignTrackerAdminResolver {
  constructor(private campaignTrackerService: CampaignTrackerService) {}

  @Query()
  @Allow(Permission.SuperAdmin)
  async myNewQuery(
    @Ctx() ctx: RequestContext,
    @Args() args: { id: ID }
  ): Promise<boolean> {
    return this.campaignTrackerService.myNewQuery(ctx, args.id);
  }

  @Mutation()
  @Transaction()
  @Allow(Permission.SuperAdmin)
  async createCampaign(
    @Ctx() ctx: RequestContext,
    @Args() { input }: MutationCreateCampaignArgs
  ): Promise<Campaign> {
    return this.campaignTrackerService.createCampaign(ctx, input);
  }
}
