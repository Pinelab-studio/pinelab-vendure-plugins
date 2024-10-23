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
import { asError } from 'catch-unknown';
import { IsNull } from 'typeorm';
import { CAMPAIGN_TRACKER_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { Campaign } from '../entities/campaign.entity';
import { OrderCampaign } from '../entities/order-campaign.entity';
import { CampaignTrackerOptions, OrderWithCampaigns } from '../types';
import {
  CampaignInput,
  CampaignListOptions,
  SortOrder,
} from '../ui/generated/graphql';
import { calculateRevenuePerCampaign } from './campaign-util';

interface JobData {
  ctx: SerializedRequestContext;
}

@Injectable()
export class CampaignTrackerService implements OnModuleInit {
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
        return this.calculateAllMetrics(ctx).catch((err: unknown) => {
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
  ): Promise<Campaign> {
    return await this.connection.getRepository(ctx, Campaign).findOneOrFail({
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
        },
        {
          ctx,
          relations: [],
          channelId: ctx.channelId,
          where: { deletedAt: IsNull() },
        }
      )
      .getManyAndCount();
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
  ): Promise<Order> {
    const campaign = await this.getCampaignByCode(ctx, campaignCode);
    const order = await this.activeOrderService.getActiveOrder(
      ctx,
      undefined,
      true
    );
    const orderCampaignRepo = this.connection.getRepository(ctx, OrderCampaign);
    const existingOrderCampaign = await orderCampaignRepo.findOne({
      where: { order, campaign },
    });
    if (existingOrderCampaign) {
      // Just update the updatedAt timestamp
      await orderCampaignRepo.save({
        id: existingOrderCampaign.id,
        updatedAt: new Date(),
      });
    } else {
      // Create new entry
      await orderCampaignRepo.save({ order, campaign });
    }
    return order;
  }

  /**
   * @description
   * Calculate metrics for all campaigns of a given channel
   */
  async calculateAllMetrics(ctx: RequestContext): Promise<void> {
    // Get all orders with this campaign
  }

  /**
   * @description
   * Calculate conversion of all campaigns of a given channel
   */
  async calculateConversions(ctx: RequestContext, nrOfDays = 7): Promise<void> {
    // Get all orders with this campaign
    // Get all orders with this campaign in the last 7 days
    // Calculate conversion rate
  }

  /**
   * Calculate Revenue of all campaigns for the last 7, 30 and 365 days
   */
  async calculateRevenue(ctx: RequestContext): Promise<void> {
    const daysAgo365 = new Date();
    daysAgo365.setDate(daysAgo365.getDate() - 365);
    const placedOrders: OrderWithCampaigns[] = [];
    let hasMore = true;
    while (hasMore) {
      const [orders, total] = await this.connection
        .getRepository(ctx, Order)
        .createQueryBuilder('order')
        .leftJoinAndSelect(
          OrderCampaign,
          'orderCampaign',
          'order.id = orderCampaign.orderId'
        )
        .leftJoinAndSelect(
          Campaign,
          'campaign',
          'order.id = orderCampaign.orderId'
        )
        .leftJoin('order.channels', 'channel')
        .where('channel.id = :channelId', { channelId: ctx.channelId })
        .andWhere('order.orderPlacedAt > :daysAgo365', { daysAgo365 })
        .limit(5000)
        .offset(placedOrders.length)
        .getManyAndCount();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- our custom join added the orderCampaings relations
      placedOrders.push(...(orders as any));
      if (placedOrders.length >= total) {
        hasMore = false;
      }
    }
    const revenuePerCampaign = calculateRevenuePerCampaign(
      this.options.attributionModel,
      placedOrders
    );
    for (const [campaignId, campaign] of revenuePerCampaign.entries()) {
      await this.connection.getRepository(ctx, Campaign).update(campaignId, {
        revenueLast365Days: campaign.revenueLast365Days,
        revenueLast30days: campaign.revenueLast30days,
        revenueLast7days: campaign.revenueLast7days,
      });
      Logger.info(`Updated revenue for campaign ${campaignId}`, loggerCtx);
    }
  }

  async triggerCalculateCampaignMetrics(ctx: RequestContext): Promise<void> {
    await this.jobQueue.add({
      ctx: ctx.serialize(),
    });
  }
}
