import { describe, expect, it, vi, afterEach } from 'vitest';
import { OrderWithCampaigns } from '../types';
import { asError } from 'catch-unknown';
import { calculateRevenuePerCampaign } from './campaign-util';

const attributionModel = {
  attributeTo: vi.fn(),
};

afterEach(() => {
  attributionModel.attributeTo.mockClear();
});

function createMockOrder(
  total = 100,
  campaigns = [{ campaign: { id: 1 } }],
  wasPlacedDaysAgo = 0
): OrderWithCampaigns {
  const orderPlacedAt = new Date();
  orderPlacedAt.setDate(orderPlacedAt.getDate() - wasPlacedDaysAgo);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    total,
    orderCampaigns: campaigns,
    orderPlacedAt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('calculateRevenuePerCampaign', () => {
  it.each([
    {
      description: 'Has revenue attributed to the 1 campaign',
      orderTotal: 100,
      orderPlacedDaysAgo: 0, // Today
      orderCampaigns: [{ campaign: { id: 1 } }],
      attributionRates: [{ campaignId: 1, attributionRate: 1 }],
      expectedRevenue365Days: 100,
      expectedRevenue30Days: 100,
      expectedRevenue7Days: 100,
    },
    {
      description: 'Has revenue attributed only to 365 days revenue',
      orderTotal: 100,
      orderPlacedDaysAgo: 31,
      orderCampaigns: [{ campaign: { id: 1 } }],
      attributionRates: [{ campaignId: 1, attributionRate: 1 }],
      expectedRevenue365Days: 100,
      expectedRevenue30Days: 0,
      expectedRevenue7Days: 0,
    },
    {
      description: 'Has revenue split over 2 campaigns',
      orderTotal: 100,
      orderPlacedDaysAgo: 0,
      orderCampaigns: [{ campaign: { id: 1 } }, { campaign: { id: 2 } }],
      attributionRates: [
        { campaignId: 1, attributionRate: 0.6 },
        { campaignId: 2, attributionRate: 0.4 },
      ],
      expectedRevenue365Days: 60, // expect only 0.6 on the first campaign
      expectedRevenue30Days: 60,
      expectedRevenue7Days: 60,
    },
  ])(
    '$description',
    ({
      orderTotal,
      orderCampaigns,
      orderPlacedDaysAgo,
      attributionRates,
      expectedRevenue365Days,
      expectedRevenue30Days,
      expectedRevenue7Days,
    }) => {
      // Mock the attribution model to return attributions based on the test values above
      attributionModel.attributeTo.mockReturnValue(attributionRates);
      // Create 2 orders, to also test summing up the revenue.
      // We divide by 2, so that the expected revenue is the same as it would be with 1 order
      const mockOrder1 = createMockOrder(
        orderTotal / 2,
        orderCampaigns,
        orderPlacedDaysAgo
      );
      const mockOrder2 = createMockOrder(
        orderTotal / 2,
        orderCampaigns,
        orderPlacedDaysAgo
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      const result = calculateRevenuePerCampaign(attributionModel as any, [
        mockOrder1,
        mockOrder2,
      ]);
      expect(result.get(1)?.revenueLast365Days).toBe(expectedRevenue365Days);
      expect(result.get(1)?.revenueLast30days).toBe(expectedRevenue30Days);
      expect(result.get(1)?.revenueLast7days).toBe(expectedRevenue7Days);
    }
  );

  it('Throws an error if the sum of all attributions is not 1', () => {
    expect.assertions(1);
    try {
      const attributions = [
        { campaignId: 1, attributionRate: 0.6 },
        { campaignId: 2, attributionRate: 0.6 },
      ];
      attributionModel.attributeTo.mockReturnValue(attributions);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      calculateRevenuePerCampaign(attributionModel as any, [createMockOrder()]);
    } catch (e) {
      expect(asError(e).message).toBe(
        "The sum of all attributions for an order should be 1, got '1.2'"
      );
    }
  });
});
