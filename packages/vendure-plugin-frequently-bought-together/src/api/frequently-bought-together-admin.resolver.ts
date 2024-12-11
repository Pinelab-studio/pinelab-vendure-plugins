import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { FrequentlyBoughtTogetherService } from '../services/frequently-bought-together.service';
import {
  FrequentlyBoughtTogetherPreview,
  QueryPreviewFrequentlyBoughtTogetherArgs,
} from '../generated-graphql-types';
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { PluginInitOptions } from '../types';
import { FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS } from '../constants';

@Resolver()
export class FrequentlyBoughtTogetherAdminResolver {
  constructor(
    @Inject(FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS)
    private options: PluginInitOptions,
    private frequentlyBoughtTogetherService: FrequentlyBoughtTogetherService
  ) {}

  @Query()
  async previewFrequentlyBoughtTogether(
    @Ctx() ctx: RequestContext,
    @Args() { support }: QueryPreviewFrequentlyBoughtTogetherArgs
  ): Promise<FrequentlyBoughtTogetherPreview> {
    if (!this.options.experimentMode) {
      throw new UserInputError(
        `This query is only available in experiment mode. Set 'expirementMode: true' in plugin's init()`
      );
    }
    return await this.frequentlyBoughtTogetherService.previewItemSets(
      ctx,
      support
    );
  }

  @Mutation()
  @Allow(Permission.UpdateSystem)
  async triggerFrequentlyBoughtTogetherCalculation(
    @Ctx() ctx: RequestContext
  ): Promise<boolean> {
    return await this.frequentlyBoughtTogetherService.triggerCalculation(ctx);
  }
}
