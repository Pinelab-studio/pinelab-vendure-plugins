import { Controller, Get } from '@nestjs/common';
import { Ctx, RequestContext } from '@vendure/core';
import { Success } from '../../test/src/generated/admin-graphql';
import { SortService } from './sort.service';
@Controller('/order-by-popularity')
export class OrderByPopularityController {
  constructor(private sortService: SortService) {}
  @Get('calculate-scores')
  async findAll(@Ctx() ctx: RequestContext): Promise<Success> {
    return this.sortService.setProductPopularity(ctx);
  }
}
