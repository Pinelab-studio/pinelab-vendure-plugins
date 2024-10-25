import { ID } from '@vendure/core';
import { Campaign } from '../entities/campaign.entity';
import { OrderWithCampaigns } from '../types';
import {
  Attribution,
  AttributionModel,
  ConnectedCampaign,
} from './attribution-models';

function isDateInLastXDays(date: Date | undefined, nrOfDays: number): boolean {
  const xDaysAgo = new Date();
  xDaysAgo.setDate(xDaysAgo.getDate() - nrOfDays);
  return (date ?? 0) > xDaysAgo;
}

/**
 * @description
 * Validate that the sum of all attributions is 1
 */
function validateAttributions(attributions: Attribution[]) {
  const sum = attributions.reduce(
    (total, attribution) => total + attribution.attributionRate,
    0
  );
  if (sum !== 1) {
    throw new Error(
      `The sum of all attributions for an order should be 1, got '${sum}'`
    );
  }
}

/**
 * @description
 * Calculate the revenue per campaign based on the attributions
 */
export function calculateRevenuePerCampaign(
  attributionModel: AttributionModel,
  placedOrders: OrderWithCampaigns[]
): Map<ID, Campaign> {
  const revenuePerCampaign = new Map<ID, Campaign>();
  for (const order of placedOrders) {
    const connectedCampaigns: ConnectedCampaign[] =
      order.connectedCampaigns.map((c) => ({
        id: c.campaign.id,
        name: c.campaign.name,
        code: c.campaign.code,
        createdAt: c.campaign.createdAt,
        updatedAt: c.campaign.updatedAt,
        connectedAt: c.updatedAt,
        orderId: c.orderId,
      }));
    const attributions = attributionModel.attributeTo(connectedCampaigns);
    validateAttributions(attributions);
    attributions.forEach((attribution) => {
      const campaign =
        revenuePerCampaign.get(attribution.campaignId) || new Campaign();
      const revenue = order.orderTotal * attribution.attributionRate;
      if (isDateInLastXDays(order.orderPlacedAt, 365)) {
        campaign.revenueLast365days += revenue;
      }
      if (isDateInLastXDays(order.orderPlacedAt, 30)) {
        campaign.revenueLast30days += revenue;
      }
      if (isDateInLastXDays(order.orderPlacedAt, 7)) {
        campaign.revenueLast7days += revenue;
      }
      revenuePerCampaign.set(attribution.campaignId, campaign);
    });
  }
  return revenuePerCampaign;
}

export function isOlderThan(
  givenDate: Date | undefined,
  milliseconds: number
): boolean {
  if (!givenDate) {
    // No date, so it's older than the given time
    return true;
  }
  const now = new Date();
  return now.getTime() - givenDate.getTime() > milliseconds;
}
