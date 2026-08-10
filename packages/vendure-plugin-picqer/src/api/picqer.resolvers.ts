import { Inject } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Logger, RequestContext } from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { PicqerOptions } from '../picqer.plugin';
import { picqerPermission } from '../custom-fields';
import { PicqerService } from './picqer.service';

@Resolver()
export class PicqerResolver {
  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private options: PicqerOptions,
    private service: PicqerService
  ) {}

  @Mutation()
  @Allow(picqerPermission.Permission)
  async triggerPicqerFullSync(@Ctx() ctx: RequestContext): Promise<boolean> {
    let allSucceeded = true;
    await this.service
      .createStockLevelJob(ctx)
      .catch((e: Error | undefined) => {
        Logger.error(
          `Failed to create jobs to pull stock levels from Picqer: ${e?.message}`,
          loggerCtx,
          e?.stack
        );
        allSucceeded = false;
      });
    await this.service
      .createPushProductsJob(ctx)
      .catch((e: Error | undefined) => {
        Logger.error(
          `Failed to create jobs to push products to Picqer: ${e?.message}`,
          loggerCtx,
          e?.stack
        );
        allSucceeded = false;
      });
    return allSucceeded;
  }
}
