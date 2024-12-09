import { Args, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { FrequentlyBoughtTogetherService } from '../services/frequently-bought-together.service';
import { QueryPreviewFrequentlyBoughtTogetherArgs } from '../generated-graphql-types';
import { Ctx, RequestContext, UserInputError } from '@vendure/core';
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
  ) {
    if (!this.options.experimentMode) {
      throw new UserInputError(
        `This query is only available in experiment mode. Set 'expirementMode: true' in plugin's init()`
      );
    }
    return this.frequentlyBoughtTogetherService.previewItemSets(ctx, support);
  }
}
