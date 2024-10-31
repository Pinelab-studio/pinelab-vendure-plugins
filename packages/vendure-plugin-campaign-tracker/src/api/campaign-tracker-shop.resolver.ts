import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Order,
  OrderService,
  Permission,
  RelationPaths,
  Relations,
  RequestContext,
  Transaction,
} from '@vendure/core';
import { CampaignTrackerService } from '../services/campaign-tracker.service';
import { MutationAddCampaignToOrderArgs } from '../ui/generated/graphql';

@Resolver()
export class CampaignTrackerShopResolver {
  constructor(
    private campaignTrackerService: CampaignTrackerService,
    private orderService: OrderService
  ) {}

  @Mutation()
  @Transaction()
  @Allow(Permission.UpdateOrder, Permission.Owner)
  async addCampaignToOrder(
    @Ctx() ctx: RequestContext,
    @Args() { campaignCode }: MutationAddCampaignToOrderArgs,
    @Relations({ entity: Order, omit: ['aggregateOrder', 'sellerOrders'] })
    relations: RelationPaths<Order>
  ): Promise<Order | undefined> {
    const order = await this.campaignTrackerService.addCampaignToOrder(
      ctx,
      campaignCode
    );
    if (order) {
      return this.orderService.findOne(ctx, order.id, relations);
    }
  }
}
