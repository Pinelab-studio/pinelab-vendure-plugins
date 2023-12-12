import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Logger,
  PermissionDefinition,
  RequestContext,
} from '@vendure/core';
import { all } from 'axios';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { PicqerOptions } from '../picqer.plugin';
import {
  PicqerConfig,
  PicqerConfigInput,
  TestPicqerInput,
} from '../ui/generated/graphql';
import { PicqerService } from './picqer.service';

export const picqerPermission = new PermissionDefinition({
  name: 'Picqer',
  description: 'Allows setting Picqer config and triggering Picqer full sync',
});

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

  @Mutation()
  @Allow(picqerPermission.Permission)
  async upsertPicqerConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: PicqerConfigInput
  ): Promise<PicqerConfig> {
    return this.service.upsertConfig(ctx, input);
  }

  @Query()
  @Allow(picqerPermission.Permission)
  async picqerConfig(@Ctx() ctx: RequestContext): Promise<PicqerConfig | null> {
    return this.service.getConfig(ctx);
  }

  @Query()
  @Allow(picqerPermission.Permission)
  async isPicqerConfigValid(
    @Ctx() ctx: RequestContext,
    @Args('input') input: TestPicqerInput
  ): Promise<boolean> {
    return this.service.testRequest(input);
  }
}
