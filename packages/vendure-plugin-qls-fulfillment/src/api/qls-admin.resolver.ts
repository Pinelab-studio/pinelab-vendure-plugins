import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  Transaction,
} from '@vendure/core';
import { QlsProductService } from '../services/qls-product.service';
import { MutationPushOrderToQlsArgs } from './generated/graphql';
import { QlsOrderService } from '../services/qls-order.service';
import {
  qlsFullSyncPermission,
  qlsPushOrderPermission,
} from '../config/permissions';

@Resolver()
export class QlsAdminResolver {
  constructor(
    private qlsProductService: QlsProductService,
    private qlsOrderService: QlsOrderService
  ) {}

  @Mutation()
  @Transaction()
  @Allow(qlsFullSyncPermission.Permission)
  async triggerQlsProductSync(@Ctx() ctx: RequestContext) {
    await this.qlsProductService.triggerFullSync(ctx);
    return true;
  }

  @Mutation()
  @Transaction()
  @Allow(qlsPushOrderPermission.Permission)
  @Allow(Permission.UpdateAdministrator)
  async pushOrderToQls(
    @Ctx() ctx: RequestContext,
    @Args() input: MutationPushOrderToQlsArgs
  ): Promise<string> {
    return await this.qlsOrderService.pushOrderToQls(ctx, input.orderId);
  }
}
