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
  ): Promise<(UtmOrderParameter & { attributedValue?: number })[]> {
    const utmParameters = await this.utmTrackerService.getUTMParameters(
      ctx,
      order.id
    );
    return utmParameters.map((param) => ({
      ...param,
      attributedValue: param.attributedPercentage
        ? param.attributedPercentage * order.total
        : undefined,
    }));
  }
}
