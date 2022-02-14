import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { orderExportPermission, OrderExportPluginConfig } from '../index';
import {
  AllExportedOrdersFilter,
  ExportedOrder,
  OrderExportConfig,
  OrderExportConfigInput,
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
    private orderExportService: OrderExportService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: OrderExportPluginConfig
  ) {}

  @Query()
  @Allow(orderExportPermission.Permission)
  async allOrderExportConfigs(
    @Ctx() ctx: RequestContext
  ): Promise<OrderExportConfig[]> {
    return this.config.strategies;
  }

  @Query()
  @Allow(orderExportPermission.Permission)
  async allExportedOrders(
    @Ctx() ctx: RequestContext,
    @Args('filter') filter: AllExportedOrdersFilter
  ): Promise<ExportedOrder[]> {
    return [
      {
        id: '12344',
        orderId: '1',
        successful: true,
        reference: '2',
        message: 'Mooi gelukt!',
        externalLink: 'https://pinelab.studio',
      },
      {
        id: '44532',
        orderId: '999999',
        successful: false,
        message: 'Verkeerd BTW code',
        externalLink: 'https://e-boekhouden.nl',
      },
    ];
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
