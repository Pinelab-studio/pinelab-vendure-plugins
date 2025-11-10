import { Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  Transaction,
  Logger,
} from '@vendure/core';
import { QlsService } from '../services/qls.service';
import { loggerCtx } from '../constants';

@Resolver()
export class QlsAdminResolver {
  constructor(private qlsService: QlsService) {}

  @Mutation()
  @Transaction()
  @Allow(Permission.SuperAdmin) // TODO setup permission
  async triggerQlsProductSync(@Ctx() ctx: RequestContext) {
    try {
      await this.qlsService.triggerSyncProducts(ctx);
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
