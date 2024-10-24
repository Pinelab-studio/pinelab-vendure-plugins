import { ID } from '@vendure/core';
import { OrderCampaign } from '../entities/order-campaign.entity';

/**
 * @description
 * A model that defines to what campaign(s) an order should be attributed.
 * An order can be attributed to multiple campaigns, as long as the total sum is 1
 * E.g. 0.6 for campaign_a and 0.4 campaign_b
 */
export interface AttributionModel {
  /**
   * OrderCampaigns are sorted by the connectedAt date in ascending order,
   * so the first campaign is the first one that was added to the order
   */
  attributeTo(orderCampaigns: OrderCampaign[]): Attribution[];
}

export interface Attribution {
  campaignId: ID;
  /**
   * @description
   * The percentage of the sale that should be attributed to this campaign.
   * Should be between 0 and 1
   */
  attributionRate: number;
}

/**
 * @description
 * Attribute the entire revenue of an order to the most recently added campaign
 */
export class LastInteractionAttribution implements AttributionModel {
  attributeTo(orderCampaigns: OrderCampaign[]): Attribution[] {
    const mostRecentlyAddedCampaign = orderCampaigns[orderCampaigns.length - 1];
    return [
      {
        campaignId: mostRecentlyAddedCampaign.id,
        attributionRate: 1,
      },
    ];
  }
}

/**
 * @description
 * Attribute the entire revenue of an order to the first campaign that was added to the order
 */
export class FirstInteractionAttribution implements AttributionModel {
  attributeTo(orderCampaigns: OrderCampaign[]): Attribution[] {
    const firstCampaign = orderCampaigns[0];
    return [
      {
        campaignId: firstCampaign.id,
        attributionRate: 1,
      },
    ];
  }
}

/**
 * @description
 * Equally attribute the revenue of an order to all campaigns that were added to the order
 */
export class LinearAttribution implements AttributionModel {
  attributeTo(orderCampaigns: OrderCampaign[]): Attribution[] {
    const totalCampaigns = orderCampaigns.length;
    return orderCampaigns.map((orderCampaign) => ({
      campaignId: orderCampaign.id,
      attributionRate: 1 / totalCampaigns,
    }));
  }
}
