import { Controller, Get, Param, Inject } from '@nestjs/common';
import { Ctx, RequestContext, UnauthorizedError } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { PopularityScoresPluginConfig } from './popularity-scores.plugin';
import { SortService } from './sort.service';

@Controller('/popularity-scores')
export class OrderByPopularityController {
  constructor(
    private sortService: SortService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: PopularityScoresPluginConfig
  ) {}

  @Get('calculate-scores/:mychanneltoken/:secret')
  async calculateScores(
    @Ctx() ctx: RequestContext,
    @Param('mychanneltoken') token: string,
    @Param('secret') secret: string
  ) {
    if (secret !== this.config.endpointSecret) {
      throw new UnauthorizedError();
    }
    await this.sortService.addScoreCalculatingJobToQueue(token, ctx);
  }
}
