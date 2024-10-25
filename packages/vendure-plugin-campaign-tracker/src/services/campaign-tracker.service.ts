import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ActiveOrderService,
  ID,
  JobQueue,
  JobQueueService,
  ListQueryBuilder,
  Logger,
  Order,
  OrderService,
  PaginatedList,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { LogicalOperator } from '@vendure/common/lib/generated-types';
import { asError } from 'catch-unknown';
import { IsNull } from 'typeorm';
import { CAMPAIGN_TRACKER_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { Campaign } from '../entities/campaign.entity';
import { OrderCampaign } from '../entities/order-campaign.entity';
import {
  CampaignTrackerOptions,
  OrderWithCampaigns,
  RawOrderQueryResult,
} from '../types';
import {
  CampaignInput,
  CampaignListOptions,
  SortOrder,
} from '../ui/generated/graphql';
import { calculateRevenuePerCampaign, isOlderThan } from './campaign-util';

interface JobData {
  ctx: SerializedRequestContext;
}

@Injectable()
export class CampaignTrackerService implements OnModuleInit {
  private readonly refreshMetricsAfter = 1000 * 60 * 60 * 6;
  private jobQueue!: JobQueue<JobData>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(CAMPAIGN_TRACKER_PLUGIN_OPTIONS)
    private options: CampaignTrackerOptions,
    private jobQueueService: JobQueueService,
    private activeOrderService: ActiveOrderService,
    private orderService: OrderService,
    private listQueryBuilder: ListQueryBuilder
  ) {}

  public async onModuleInit(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'campaign-tracker',
      process: (job) => {
        const ctx = RequestContext.deserialize(job.data.ctx);
        return this.calculateRevenue(ctx).catch((err: unknown) => {
          Logger.warn(
            `Error in calculateCampaignMetrics: ${asError(err).message}`
          );
        });
      },
    });
  }

  async createCampaign(
    ctx: RequestContext,
    input: CampaignInput
  ): Promise<Campaign> {
    return await this.connection.getRepository(ctx, Campaign).save({
      ...input,
      channelId: ctx.channelId,
    });
  }

  async deleteCampaign(ctx: RequestContext, id: ID): Promise<void> {
    await this.getCampaign(ctx, id);
    await this.connection
      .getRepository(ctx, Campaign)
      .update(id, { deletedAt: new Date() });
  }

  async getCampaign(ctx: RequestContext, id: ID): Promise<Campaign> {
    return await this.connection.getRepository(ctx, Campaign).findOneOrFail({
      where: {
        id,
        channelId: ctx.channelId,
        deletedAt: IsNull(),
      },
    });
  }

  async getCampaignByCode(
    ctx: RequestContext,
    code: string
  ): Promise<Campaign | undefined | null> {
    return await this.connection.getRepository(ctx, Campaign).findOne({
      where: {
        code,
        channelId: ctx.channelId,
        deletedAt: IsNull(),
      },
    });
  }

  async updateCampaign(
    ctx: RequestContext,
    id: ID,
    input: CampaignInput
  ): Promise<Campaign> {
    await this.connection.getRepository(ctx, Campaign).update(id, input);
    return this.getCampaign(ctx, id);
  }

  async getCampaigns(
    ctx: RequestContext,
    options: CampaignListOptions = {}
  ): Promise<PaginatedList<Campaign>> {
    if (!options.sort) {
      options.sort = { createdAt: SortOrder.Desc };
    }
    const [campaigns, count] = await this.listQueryBuilder
      .build(
        Campaign,
        {
          ...options,
          filterOperator: LogicalOperator.OR,
        },
        {
          ctx,
          relations: [],
          where: {
            deletedAt: IsNull(),
            channelId: ctx.channelId,
          },
        }
      )
      .getManyAndCount();
    // Trigger recalculation of metrics if any campaign is older than the refresh interval
    const outDatedCampaign = campaigns.find((campaign) =>
      isOlderThan(campaign.metricsUpdatedAt, this.refreshMetricsAfter)
    );
    if (outDatedCampaign) {
      this.triggerCalculateCampaignMetrics(ctx).catch((err) => {
        Logger.error(
          `Error creating recalculate-metrics job: ${err}`,
          loggerCtx
        );
      });
    }
    return {
      items: campaigns,
      totalItems: count,
    };
  }

  /**
   * @description
   * Connect a campaign to the current active order.
   * Creates a new active order if none found
   */
  async addCampaignToOrder(
    ctx: RequestContext,
    campaignCode: string
  ): Promise<Order | undefined> {
    const campaign = await this.getCampaignByCode(ctx, campaignCode);
    if (!campaign) {
      Logger.warn(`No campaign found with code ${campaignCode}`, loggerCtx);
      return; // No campaign found
    }
    const order = await this.activeOrderService.getActiveOrder(
      ctx,
      undefined,
      true
    );
    const orderCampaignRepo = this.connection.getRepository(ctx, OrderCampaign);
    const existingOrderCampaign = await orderCampaignRepo.findOne({
      where: { orderId: order.id, campaign: { id: campaign.id } },
    });
    if (existingOrderCampaign) {
      // Just update the updatedAt timestamp
      await orderCampaignRepo.save({
        id: existingOrderCampaign.id,
        updatedAt: new Date(),
      });
    } else {
      // Create new entry
      await orderCampaignRepo.save({ orderId: order.id, campaign });
      Logger.info(
        `Added campaign ${campaignCode} to order ${order.code}`,
        loggerCtx
      );
    }
    return order;
  }

  /**
   * Calculate Revenue of all campaigns for the last 7, 30 and 365 days
   */
  async calculateRevenue(ctx: RequestContext): Promise<void> {
    const placedOrders = await this.getOrdersWithCampaigns(
      ctx,
      'orderPlacedAt',
      365
    );
    const revenuePerCampaign = calculateRevenuePerCampaign(
      this.options.attributionModel,
      placedOrders
    );

    for (const [campaignId, campaign] of revenuePerCampaign.entries()) {
      await this.connection.getRepository(ctx, Campaign).update(campaignId, {
        revenueLast365days: Math.round(campaign.revenueLast365days),
        revenueLast30days: Math.round(campaign.revenueLast30days),
        revenueLast7days: Math.round(campaign.revenueLast7days),
      });
      Logger.info(`Updated revenue for campaign ${campaignId}`, loggerCtx);
    }
    // Mark metrics as updated
    await this.connection.getRepository(ctx, Campaign).update(
      {
        channelId: ctx.channelId,
      },
      { metricsUpdatedAt: new Date() }
    );
  }

  async triggerCalculateCampaignMetrics(ctx: RequestContext): Promise<void> {
    await this.jobQueue.add({
      ctx: ctx.serialize(),
    });
    Logger.info(
      `Added job to calculate campaign metrics for channel ${ctx.channel.token}`,
      loggerCtx
    );
  }

  /**
   * @description
   * Find all orders of the last X days in the current channel with campaigns attached.
   * By filtering on 'orderPlacedAt' or 'updatedAt' you can differentiate between placed and all orders
   */
  async getOrdersWithCampaigns(
    ctx: RequestContext,
    dateFilter: 'orderPlacedAt' | 'updatedAt',
    lastXDays: number
  ): Promise<OrderWithCampaigns[]> {
    const lastXDaysDate = new Date();
    lastXDaysDate.setDate(lastXDaysDate.getDate() - lastXDays);
    const allOrders: RawOrderQueryResult[] = [];
    let hasMore = true;
    while (hasMore) {
      const query = this.connection
        .getRepository(ctx, Order)
        .createQueryBuilder('order')
        .leftJoin('order.channels', 'channel')
        .leftJoinAndSelect(
          OrderCampaign,
          'orderCampaign',
          'order.id = orderCampaign.orderId'
        )
        .leftJoinAndSelect('orderCampaign.campaign', 'campaign')
        .where('channel.id = :channelId', { channelId: ctx.channelId })
        .andWhere(`order.${dateFilter} > :lastXDaysDate`, { lastXDaysDate })
        .andWhere(`campaign.deletedAt IS NULL`)
        .limit(5000)
        .offset(allOrders.length);
      const orders: RawOrderQueryResult[] = await query.getRawMany();
      const total = await query.getCount();
      allOrders.push(...orders);
      if (allOrders.length >= total) {
        hasMore = false;
      }
    }
    return this.mapToOrderWithCampaigns(allOrders);
  }

  /**
   * The raw order results from the DB hold the data in a flat structure, so a single order can have multiple rows.
   * This function maps all campaigns to a single order object
   */
  private mapToOrderWithCampaigns(
    rawOrderResults: RawOrderQueryResult[]
  ): OrderWithCampaigns[] {
    const campaignsPerOrder = new Map<ID, OrderWithCampaigns>();
    rawOrderResults.forEach((o) => {
      const campaign = new Campaign({
        id: o.campaign_id,
        code: o.campaign_code,
        name: o.campaign_name,
        channelId: o.campaign_channelId,
        revenueLast7days: o.campaign_revenueLast7days,
        revenueLast30days: o.campaign_revenueLast30days,
        revenueLast365days: o.campaign_revenueLast365days,
        metricsUpdatedAt: o.campaign_metricsUpdatedAt,
      });
      const orderCampaign = new OrderCampaign({
        id: o.orderCampaign_id,
        createdAt: new Date(o.orderCampaign_createdAt),
        updatedAt: new Date(o.orderCampaign_updatedAt),
        orderId: o.order_id,
        campaign: campaign,
      });
      const existingCampaigns =
        campaignsPerOrder.get(o.order_id)?.connectedCampaigns || [];
      campaignsPerOrder.set(o.order_id, {
        orderId: o.order_id,
        orderTotal: o.order_subTotal + o.order_shipping,
        orderPlacedAt: o.order_orderPlacedAt
          ? new Date(o.order_orderPlacedAt)
          : undefined,
        orderUpdatedAt: new Date(o.order_updatedAt),
        connectedCampaigns: [...existingCampaigns, orderCampaign],
      });
    });
    return Array.from(campaignsPerOrder.values()).map((o) => {
      // Sort by connectedAt date in ascending order (most recent last)
      o.connectedCampaigns.sort(
        (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime()
      );
      return o;
    });
  }
}
