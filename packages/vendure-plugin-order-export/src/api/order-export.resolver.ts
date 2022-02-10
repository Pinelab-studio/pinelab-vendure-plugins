import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { orderExportPermission } from '../index';
import {
  OrderExportStrategy,
  OrderExportStrategyInput,
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
  ): Promise<OrderExportStrategy[]> {
    return strategies;
  }

  @Mutation()
  @Allow(orderExportPermission.Permission)
  async updateOrderExportStrategy(
    @Ctx() ctx: RequestContext,
    @Args('input') input: OrderExportStrategyInput
  ): Promise<OrderExportStrategy[]> {
    console.log('==========', input);
    return strategies;
  }
}
