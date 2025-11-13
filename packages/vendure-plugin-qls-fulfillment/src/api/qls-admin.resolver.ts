import { Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext, Transaction } from '@vendure/core';
import { QlsProductService } from '../services/qls-product.service';
import { fullSyncPermission } from '../config/permissions';

@Resolver()
export class QlsAdminResolver {
  constructor(private qlsService: QlsProductService) {}

  @Mutation()
  @Transaction()
  @Allow(fullSyncPermission.Permission)
  async triggerQlsProductSync(@Ctx() ctx: RequestContext) {
    await this.qlsService.triggerFullSync(ctx);
    return true;
  }
}
