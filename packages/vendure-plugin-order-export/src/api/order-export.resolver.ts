import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { orderExportPermission } from '../index';
import {
  OrderExportConfig,
  OrderExportConfigInput,
} from '../ui/generated/graphql';
import { strategies } from './strategies';

/**
 * Graphql resolvers for retrieving and updating myparcel configs for channel
 */
@Resolver()
export class OrderExportResolver {
  constructor() {}

  @Query()
  @Allow(orderExportPermission.Permission)
  async allOrderExportStrategies(
    @Ctx() ctx: RequestContext
  ): Promise<OrderExportConfig[]> {
    return strategies;
  }

  @Mutation()
  @Allow(orderExportPermission.Permission)
  async updateOrderExportStrategy(
    @Ctx() ctx: RequestContext,
    @Args('input') input: OrderExportConfigInput
  ): Promise<OrderExportConfig[]> {
    console.log('==========', input);
    return strategies;
  }
}
