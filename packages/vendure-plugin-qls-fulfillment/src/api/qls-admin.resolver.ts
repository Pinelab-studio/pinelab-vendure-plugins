import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Order,
  Permission,
  ProductVariant,
  RequestContext,
  Transaction,
} from '@vendure/core';
import {
  qlsFullSyncPermission,
  qlsPushOrderPermission,
} from '../config/permissions';
import { QlsOrderService } from '../services/qls-order.service';
import { QlsProductService } from '../services/qls-product.service';
import {
  MutationAddAdditionalEansToQlsArgs,
  MutationPushOrderToQlsArgs,
} from './generated/graphql';

@Resolver()
export class QlsAdminResolver {
  constructor(
    private qlsProductService: QlsProductService,
    private qlsOrderService: QlsOrderService
  ) {}

  @ResolveField()
  @Resolver('Order')
  @Allow(qlsPushOrderPermission.Permission)
  @Allow(Permission.UpdateAdministrator)
  async qlsOrderIds(
    @Ctx() ctx: RequestContext,
    @Parent() order: Order
  ): Promise<string[]> {
    return this.qlsOrderService.getQlsOrderIdsForOrder(ctx, order.id);
  }

  @ResolveField()
  @Resolver('Order')
  @Allow(qlsPushOrderPermission.Permission)
  @Allow(Permission.UpdateAdministrator)
  async qlsOrderUrl(
    @Ctx() ctx: RequestContext,
    @Parent() order: Order
  ): Promise<string | null> {
    return this.qlsOrderService.getQlsOrderUrl(ctx, order.id);
  }

  @ResolveField()
  @Resolver('ProductVariant')
  async qlsProductUrl(
    @Ctx() ctx: RequestContext,
    @Parent() productVariant: ProductVariant
  ): Promise<string | null> {
    return this.qlsProductService.getQlsProductUrl(ctx, productVariant);
  }

  @Mutation()
  @Transaction()
  @Allow(qlsFullSyncPermission.Permission)
  async triggerQlsProductSync(@Ctx() ctx: RequestContext) {
    await this.qlsProductService.triggerFullSync(ctx);
    return true;
  }

  @Mutation()
  @Transaction()
  @Allow(qlsFullSyncPermission.Permission)
  async addAdditionalEANSToQLS(
    @Ctx() ctx: RequestContext,
    @Args() input: MutationAddAdditionalEansToQlsArgs
  ): Promise<string[]> {
    return await this.qlsProductService.addAdditionalEANsToQls(
      ctx,
      input.variantId,
      input.additionalEANS
    );
  }

  @Mutation()
  @Transaction()
  @Allow(qlsPushOrderPermission.Permission)
  @Allow(Permission.UpdateAdministrator)
  async pushOrderToQls(
    @Ctx() ctx: RequestContext,
    @Args() input: MutationPushOrderToQlsArgs
  ): Promise<string> {
    return await this.qlsOrderService.pushOrderToQls(ctx, input.orderId, true);
  }
}
