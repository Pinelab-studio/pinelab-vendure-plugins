import { Order } from '@vendure/core';

export interface PluginInitOptions {
  /**
   * @description
   * The attribution model used for calculating revenue per campaign
   */
  attributionModel?: AttributionModel;
}

/**
 * @description
 * A model that defines what attributions should be made for a specific order.
 * Attribution can be split between multiple campaigns, e.g. 0.5 campaign_a and 0.5 campaign_b
 */
export interface AttributionModel {
  attributeTo(order: Order): Attribution[];
}

/**
 * @description
 * A campaign connected to this order.
 * C.q. a customer created an order while coming from a specific campaign.
 */
export interface ConnectedCampaign {
  campaignCode: string;
  /**
   * @description
   * The moment this campaign code was connected to the order
   */
  connectedOn: Date;
}

export interface Attribution {
  campaignCode: string;
  /**
   * @description
   * The percentage of the sale that should be attributed to this campaign.
   * Should be between 0 and 1
   */
  attribution: number;
}
