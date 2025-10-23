import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, Order, RequestContext } from '@vendure/core';
import { UtmOrderParameter } from '../entities/utm-order-parameter.entity';
import { UTMTrackerService } from '../services/utm-tracker.service';

@Resolver()
export class UTMTrackerAdminResolver {
  constructor(private utmTrackerService: UTMTrackerService) {}

  @ResolveField()
  @Resolver('Order')
  async utmParameters(
    @Ctx() ctx: RequestContext,
    @Parent() order: Order
  ): Promise<UtmOrderParameter[]> {
    return await this.utmTrackerService.getUTMParameters(ctx, order.id);
  }
}
