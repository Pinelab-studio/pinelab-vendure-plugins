import { describe, expect, it } from 'vitest';
import { UtmOrderParameter } from '../entities/utm-order-parameter.entity';
import { FirstClickAttribution } from './first-click-attribution';
import { LastClickAttribution } from './last-click-attribution';
import { LinearAttribution } from './linear-attribution';
import { TimeDecayAttribution } from './time-decay-attribution';

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
        createMockUtmParameter(1, new Date('2024-01-01')), // oldest - should get 100%
        createMockUtmParameter(2, new Date('2024-01-02')),
        createMockUtmParameter(3, new Date('2024-01-03')), // newest
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
        createMockUtmParameter(1, new Date('2024-01-01')), // oldest
        createMockUtmParameter(2, new Date('2024-01-02')),
        createMockUtmParameter(3, new Date('2024-01-03')), // newest - should get 100%
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

  describe('TimeDecayAttribution', () => {
    it('Gives higher attribution to more recent parameters and sums to ~1', () => {
      const model = new TimeDecayAttribution();
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const utmParams = [
        createMockUtmParameter(1, tenDaysAgo), // older
        createMockUtmParameter(2, now), // newer
      ];
      const result = model.calculateAttribution(utmParams);
      expect(result).toHaveLength(2);
      const sum = result.reduce((s, r) => s + r.attributionPercentage, 0);
      expect(sum).toBeCloseTo(1, 4);
      const newer =
        result.find((r) => r.utmParameterId === 2)?.attributionPercentage ?? 0;
      const older =
        result.find((r) => r.utmParameterId === 1)?.attributionPercentage ?? 0;
      expect(newer).toBeGreaterThan(older);
    });
  });
});
