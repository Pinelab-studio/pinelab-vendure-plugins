import { ID } from '@vendure/core';
import { OrderCampaign } from './entities/order-campaign.entity';
import { AttributionModel } from './services/attribution-models';

export interface CampaignTrackerOptions {
  /**
   * @description
   * The attribution model used for calculating revenue per campaign
   */
  attributionModel: AttributionModel;
}

export interface OrderWithCampaigns {
  orderId: ID;
  orderTotal: number;
  orderPlacedAt?: Date;
  orderUpdatedAt: Date;
  connectedCampaigns: OrderCampaign[];
}

export interface RawOrderQueryResult {
  order_createdAt: string;
  order_updatedAt: string;
  order_code: string;
  order_state: string;
  order_orderPlacedAt: string;
  order_currencyCode: string;
  order_id: ID;
  order_customerId: number;
  order_subTotal: number;
  order_subTotalWithTax: number;
  order_shipping: number;
  order_shippingWithTax: number;
  orderCampaign_createdAt: string;
  orderCampaign_updatedAt: string;
  orderCampaign_id: ID;
  orderCampaign_orderId: number;
  orderCampaign_campaignId: number;
  campaign_createdAt: string;
  campaign_updatedAt: string;
  campaign_deletedAt?: string;
  campaign_channelId: string;
  campaign_code: string;
  campaign_name: string;
  campaign_conversionLast7Days: number;
  campaign_revenueLast7days: number;
  campaign_revenueLast30days: number;
  campaign_revenueLast365Days: number;
  campaign_metricsUpdatedAt?: string;
  campaign_id: ID;
}
