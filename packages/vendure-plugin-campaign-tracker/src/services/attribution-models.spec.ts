import { describe, it, expect } from 'vitest';
import {
  LastInteractionAttribution,
  FirstInteractionAttribution,
  LinearAttribution,
  ConnectedCampaign,
} from './attribution-models';

describe('Attribution Models', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mockOrderCampaigns: ConnectedCampaign[] = [
    { id: 1 },
    { id: 2 },
    { id: 3 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any;

  it('Attributes 100% to the last interaction with LastInteractionAttribution', () => {
    const result = new LastInteractionAttribution().attributeTo(
      mockOrderCampaigns
    );
    expect(result).toEqual([
      {
        campaignId: 3,
        attributionRate: 1,
      },
    ]);
  });

  it('Attributes 100% to the first interaction with FirstInteractionAttribution', () => {
    const result = new FirstInteractionAttribution().attributeTo(
      mockOrderCampaigns
    );
    expect(result).toEqual([
      {
        campaignId: 1,
        attributionRate: 1,
      },
    ]);
  });

  it('Attributes 33% to each interaction with LinearAttribution', () => {
    const result = new LinearAttribution().attributeTo(mockOrderCampaigns);
    expect(result.length).toBe(3);
    result.forEach((attribution) => {
      expect(attribution.attributionRate).toBe(0.3333333333333333);
    });
  });
});
