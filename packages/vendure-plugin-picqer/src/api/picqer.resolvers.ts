import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { permission as picqerPermission } from '..';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { PicqerOptions } from '../picqer.plugin';
import {
  PicqerConfig,
  PicqerConfigInput,
  TestPicqerInput,
} from '../ui/generated/graphql';
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
    return this.service.triggerFullSync(ctx);
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
  async picqerConfig(
    @Ctx() ctx: RequestContext
  ): Promise<PicqerConfig | undefined> {
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
