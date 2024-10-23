import { ID, Order } from '@vendure/core';
import { Attribution, AttributionModel, OrderWithCampaigns } from '../types';
import { Campaign } from '../entities/campaign.entity';

type OrderWithPlacedAt = Pick<Order, 'orderPlacedAt'>;

function wasOrderPlacedInLastXDays(
  order: OrderWithPlacedAt,
  nrOfDays: number
): boolean {
  const xDaysAgo = new Date();
  xDaysAgo.setDate(xDaysAgo.getDate() - nrOfDays);
  return (order.orderPlacedAt ?? 0) > xDaysAgo;
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
): Map<ID, Partial<Campaign>> {
  const revenuePerCampaign = new Map<ID, Campaign>();
  for (const order of placedOrders) {
    const attributions = attributionModel.attributeTo(order.orderCampaigns);
    validateAttributions(attributions);
    attributions.forEach((attribution) => {
      const campaign =
        revenuePerCampaign.get(attribution.campaignId) || new Campaign();
      const revenue = order.total * attribution.attributionRate;
      if (wasOrderPlacedInLastXDays(order, 365)) {
        campaign.revenueLast365Days += revenue;
      }
      if (wasOrderPlacedInLastXDays(order, 30)) {
        campaign.revenueLast30days += revenue;
      }
      if (wasOrderPlacedInLastXDays(order, 7)) {
        campaign.revenueLast7days += revenue;
      }
      revenuePerCampaign.set(attribution.campaignId, campaign);
    });
  }
  return revenuePerCampaign;
}
