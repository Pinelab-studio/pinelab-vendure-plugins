import { Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Logger, RequestContext, Transaction } from '@vendure/core';
import { loggerCtx } from '../constants';
import { QlsProductService } from '../services/qls-product.service';
import { fullSyncPermission } from './permissions';

@Resolver()
export class QlsAdminResolver {
  constructor(private qlsService: QlsProductService) {}

  @Mutation()
  @Transaction()
  @Allow(fullSyncPermission.Permission)
  async triggerQlsProductSync(@Ctx() ctx: RequestContext) {
    try {
      await this.qlsService.triggerFullSyncProducts(ctx);
      return true;
    } catch (error) {
      Logger.error(
        'Error while adding push products job to job queue',
        loggerCtx,
        (error as Error).message
      );
      return false;
    }
  }
}
