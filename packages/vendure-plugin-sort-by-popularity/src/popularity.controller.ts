import { Controller, Get, Param } from '@nestjs/common';
import { Ctx, RequestContext } from '@vendure/core';
import { Success } from '../../test/src/generated/admin-graphql';
import { SortService } from './sort.service';
@Controller('/order-by-popularity')
export class OrderByPopularityController {
  constructor(private sortService: SortService) {}
  @Get('calculate-scores/:mychanneltoken')
  async calculateScores(
    @Ctx() ctx: RequestContext,
    @Param('mychanneltoken') token: string
  ) {
    this.sortService.addScoreCalculatingJobToQueue(token);
  }
}
