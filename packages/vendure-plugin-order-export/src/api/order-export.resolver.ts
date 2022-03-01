import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import {
  orderExportPermission,
  OrderExportPluginConfig,
  OrderExportResultFilter,
} from '../index';
import {
  OrderExportConfig,
  OrderExportConfigInput,
  OrderExportResultList,
} from '../ui/generated/graphql';
import { strategies } from './strategies';
import { OrderExportService } from './order-export.service';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { Inject } from '@nestjs/common';

/**
 * Graphql resolvers for retrieving and updating myparcel configs for channel
 */
@Resolver()
export class OrderExportResolver {
  constructor(
    private service: OrderExportService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: OrderExportPluginConfig
  ) {}

  @Query()
  @Allow(orderExportPermission.Permission)
  async orderExportConfigs(
    @Ctx() ctx: RequestContext
  ): Promise<OrderExportConfig[]> {
    return this.config.strategies;
  }

  @Query()
  @Allow(orderExportPermission.Permission)
  async orderExportResults(
    @Ctx() ctx: RequestContext,
    @Args('filter') filter: OrderExportResultFilter
  ): Promise<OrderExportResultList> {
    return this.service.getOrderExportResults(ctx, filter);
  }

  @Mutation()
  @Allow(orderExportPermission.Permission)
  async updateOrderExportConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: OrderExportConfigInput
  ): Promise<OrderExportConfig[]> {
    console.log('==========', input);
    return strategies;
  }
}
