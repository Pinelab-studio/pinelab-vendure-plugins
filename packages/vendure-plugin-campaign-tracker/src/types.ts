import { ID } from '@vendure/core';
import { OrderCampaign } from './entities/order-campaign.entity';

export interface PluginInitOptions {
  /**
   * @description
   * The attribution model used for calculating revenue per campaign
   */
  attributionModel?: AttributionModel;
}

/**
 * @description
 * A model that defines to what campaign(s) an order should be attributed.
 * An order can be attributed to multiple campaigns, as long as the total sum is 1
 * E.g. 0.6 for campaign_a and 0.4 campaign_b
 */
export interface AttributionModel {
  attributeTo(orderCampaign: OrderCampaign): Attribution[];
}

export interface Attribution {
  campaignId: ID;
  /**
   * @description
   * The percentage of the sale that should be attributed to this campaign.
   * Should be between 0 and 1
   */
  attribution: number;
}
