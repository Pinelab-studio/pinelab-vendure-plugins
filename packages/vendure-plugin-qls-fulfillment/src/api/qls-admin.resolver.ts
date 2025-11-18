import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext, Transaction } from '@vendure/core';
import { QlsProductService } from '../services/qls-product.service';
import { fullSyncPermission } from '../config/permissions';
import { MutationPushOrderToQlsArgs } from './generated/graphql';
import { QlsOrderService } from '../services/qls-order.service';

@Resolver()
export class QlsAdminResolver {
  constructor(
    private qlsService: QlsProductService,
    private qlsOrderService: QlsOrderService
  ) {}

  @Mutation()
  @Transaction()
  @Allow(fullSyncPermission.Permission)
  async triggerQlsProductSync(@Ctx() ctx: RequestContext) {
    await this.qlsService.triggerFullSync(ctx);
    return true;
  }

  @Mutation()
  @Transaction()
  @Allow(fullSyncPermission.Permission)
  async pushOrderToQls(
    @Ctx() ctx: RequestContext,
    @Args() input: MutationPushOrderToQlsArgs
  ): Promise<string> {
    return await this.qlsOrderService.pushOrderToQls(ctx, input.orderId);
  }
}
