import { describe, expect, it } from 'vitest';
import { UtmOrderParameter } from '../entities/utm-order-parameter.entity';
import { FirstClickAttribution } from './first-click-attribution';
import { LastClickAttribution } from './last-click-attribution';
import { LinearAttribution } from './linear-attribution';
import { UShapedAttribution } from './u-shaped-attribution';

describe('Attribution Models', () => {
  const createMockUtmParameter = (
    id: number,
    connectedAt: Date
  ): UtmOrderParameter => {
    return {
      id,
      connectedAt,
      utmSource: `source${id}`,
      utmMedium: `medium${id}`,
      utmCampaign: `campaign${id}`,
      orderId: 1,
    } as UtmOrderParameter;
  };

  describe('FirstClickAttribution', () => {
    it('Gives 100% attribution to the first (oldest) parameter', () => {
      const firstClickAttribution = new FirstClickAttribution();
      const utmParams = [
        createMockUtmParameter(3, new Date('2024-01-03')), // newest
        createMockUtmParameter(2, new Date('2024-01-02')),
        createMockUtmParameter(1, new Date('2024-01-01')), // oldest - should get 100%
      ];
      const result = firstClickAttribution.calculateAttribution(utmParams);
      expect(result[0].utmParameterId).toEqual(1);
      expect(result[0].attributionPercentage).toEqual(1);
    });
  });

  describe('LastClickAttribution', () => {
    it('Gives 100% attribution to the last (newest) parameter', () => {
      const lastClickAttribution = new LastClickAttribution();
      const utmParams = [
        createMockUtmParameter(3, new Date('2024-01-03')), // newest - should get 100%
        createMockUtmParameter(2, new Date('2024-01-02')),
        createMockUtmParameter(1, new Date('2024-01-01')), // oldest
      ];
      const result = lastClickAttribution.calculateAttribution(utmParams);
      expect(result[0].utmParameterId).toEqual(3);
      expect(result[0].attributionPercentage).toEqual(1);
    });
  });

  describe('LinearAttribution', () => {
    it('Splits attribution evenly between all parameters', () => {
      const linearAttribution = new LinearAttribution();
      const utmParams = [
        createMockUtmParameter(1, new Date('2024-01-01')),
        createMockUtmParameter(2, new Date('2024-01-02')),
        createMockUtmParameter(3, new Date('2024-01-03')),
      ];
      const result = linearAttribution.calculateAttribution(utmParams);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        utmParameterId: 1,
        attributionPercentage: 0.3333,
      });
      expect(result[1]).toEqual({
        utmParameterId: 2,
        attributionPercentage: 0.3333,
      });
      expect(result[2]).toEqual({
        utmParameterId: 3,
        attributionPercentage: 0.3333,
      });
    });
  });

  describe('UShapedAttribution', () => {
    it('Gives 40% to first and last click, middle parameters share remaining 20%, and sums to 1', () => {
      const model = new UShapedAttribution();
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      // Parameters are sorted newest first (descending by connectedAt)
      const utmParams = [
        createMockUtmParameter(4, now), // newest (first click) - 40%
        createMockUtmParameter(3, oneDayAgo), // second (middle) - 10%
        createMockUtmParameter(2, twoDaysAgo), // third (middle) - 10%
        createMockUtmParameter(1, threeDaysAgo), // oldest (last click) - 40%
      ];
      const result = model.calculateAttribution(utmParams);
      expect(result).toHaveLength(4);

      const newest =
        result.find((r) => r.utmParameterId === 4)?.attributionPercentage ?? 0;
      const second =
        result.find((r) => r.utmParameterId === 3)?.attributionPercentage ?? 0;
      const third =
        result.find((r) => r.utmParameterId === 2)?.attributionPercentage ?? 0;
      const oldest =
        result.find((r) => r.utmParameterId === 1)?.attributionPercentage ?? 0;

      expect(newest).toBe(0.4); // 40% - first click
      expect(second).toBe(0.1); // 10% - middle (20% / 2)
      expect(third).toBe(0.1); // 10% - middle (20% / 2)
      expect(oldest).toBe(0.4); // 40% - last click

      const sum = result.reduce((s, r) => s + r.attributionPercentage, 0);
      expect(sum).toBe(1);
    });

    it('Gives 50% to each when only 2 parameters', () => {
      const model = new UShapedAttribution();
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      // Newest first
      const utmParams = [
        createMockUtmParameter(2, now),
        createMockUtmParameter(1, oneDayAgo),
      ];
      const result = model.calculateAttribution(utmParams);
      expect(result).toHaveLength(2);
      expect(
        result.find((r) => r.utmParameterId === 2)?.attributionPercentage
      ).toBe(0.5);
      expect(
        result.find((r) => r.utmParameterId === 1)?.attributionPercentage
      ).toBe(0.5);
      const sum = result.reduce((s, r) => s + r.attributionPercentage, 0);
      expect(sum).toBe(1);
    });

    it('Gives 100% to the only parameter when only 1 is given', () => {
      const model = new UShapedAttribution();
      const now = new Date();
      const utmParams = [createMockUtmParameter(1, now)];
      const result = model.calculateAttribution(utmParams);
      expect(result).toHaveLength(1);
      expect(result[0].utmParameterId).toBe(1);
      expect(result[0].attributionPercentage).toBe(1);
    });
  });
});
