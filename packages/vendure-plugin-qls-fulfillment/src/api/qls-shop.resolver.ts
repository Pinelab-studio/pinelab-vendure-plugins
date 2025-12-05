import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { QlsOrderService } from '../services/qls-order.service';
import {
  QlsServicePoint,
  QlsServicePointSearchInput,
} from './generated/graphql';

@Resolver()
export class QlsShopResolver {
  constructor(private qlsOrderService: QlsOrderService) {}

  @Query()
  async qlsServicePoints(
    @Ctx() ctx: RequestContext,
    @Args('input') input: QlsServicePointSearchInput
  ): Promise<QlsServicePoint[]> {
    return await this.qlsOrderService.getServicePoints(ctx, input);
  }
}
