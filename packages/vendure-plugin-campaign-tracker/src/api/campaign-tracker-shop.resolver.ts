import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Order,
  Permission,
  RequestContext,
  Transaction,
} from '@vendure/core';
import { CampaignTrackerService } from '../services/campaign-tracker.service';
import { MutationAddCampaignToOrderArgs } from '../ui/generated/graphql';

@Resolver()
export class CampaignTrackerShopResolver {
  constructor(private campaignTrackerService: CampaignTrackerService) {}

  @Mutation()
  @Transaction()
  @Allow(Permission.UpdateOrder, Permission.Owner)
  async addCampaignToOrder(
    @Ctx() ctx: RequestContext,
    @Args() { campaignCode }: MutationAddCampaignToOrderArgs
  ): Promise<Order | undefined> {
    return await this.campaignTrackerService.addCampaignToOrder(
      ctx,
      campaignCode
    );
  }
}
