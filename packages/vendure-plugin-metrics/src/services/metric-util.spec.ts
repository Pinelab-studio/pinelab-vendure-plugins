import {
  getMonthName,
  groupEntitiesPerMonth,
  mapToSeries,
} from './metric-util';
import { AdvancedMetricSeries } from '../ui/generated/graphql';
import { describe, it, expect } from 'vitest';

describe('getMonthName function', () => {
  it('returns correct month names for valid indices', () => {
    expect(getMonthName(0)).toBe('Jan');
    expect(getMonthName(6)).toBe('Jul');
    expect(getMonthName(11)).toBe('Dec');
  });

  it('returns undefined for invalid indices', () => {
    expect(getMonthName(12)).toBeUndefined();
    expect(getMonthName(-1)).toBeUndefined();
  });
});

describe('splitEntitiesInMonths function', () => {
  // Test entities with different date fields
  const testEntities = [
    {
      id: 1,
      createdAt: new Date('2023-01-15'),
      updatedAt: new Date('2023-01-20'),
      orderPlacedAt: new Date('2023-01-25'),
    },
    {
      id: 2,
      createdAt: new Date('2023-02-10'),
      updatedAt: new Date('2023-02-15'),
      orderPlacedAt: new Date('2023-02-20'),
    },
    {
      id: 3,
      createdAt: new Date('2023-02-25'),
      updatedAt: new Date('2023-03-05'),
      orderPlacedAt: new Date('2023-03-10'),
    },
    {
      id: 4,
      createdAt: new Date('2023-04-01'),
      updatedAt: new Date('2023-04-02'),
      orderPlacedAt: new Date('2023-04-03'),
    },
  ];

  it('splits entities by createdAt correctly', () => {
    const from = new Date('2023-01-01');
    const to = new Date('2023-03-01');
    const result = groupEntitiesPerMonth(testEntities, 'createdAt', from, to);

    // Should have 2 months (Jan and Feb)
    expect(result.length).toBe(2);

    // January should have 1 entity
    expect(result.find((m) => m.monthNr === 0)?.entities.length).toBe(1);

    // February should have 2 entities
    expect(result.find((m) => m.monthNr === 1)?.entities.length).toBe(2);
  });

  it('splits entities by orderPlacedAt correctly', () => {
    const from = new Date('2023-01-01');
    const to = new Date('2023-05-01');
    const result = groupEntitiesPerMonth(
      testEntities,
      'orderPlacedAt',
      from,
      to
    );

    // Should have 4 months (Jan, Feb, Mar, Apr, May)
    expect(result.length).toBe(5);

    // Check entity count per month
    expect(
      result.find((m) => m.monthNr === 0 && m.year === 2023)?.entities.length
    ).toBe(1);
    expect(
      result.find((m) => m.monthNr === 1 && m.year === 2023)?.entities.length
    ).toBe(1);
    expect(
      result.find((m) => m.monthNr === 2 && m.year === 2023)?.entities.length
    ).toBe(1);
    expect(
      result.find((m) => m.monthNr === 3 && m.year === 2023)?.entities.length
    ).toBe(1);
  });

  it('includes empty months in the range', () => {
    const from = new Date('2022-11-01');
    const to = new Date('2023-02-01');
    const result = groupEntitiesPerMonth(testEntities, 'createdAt', from, to);
    // Should have 3 months (Nov, Dec, Jan)
    expect(result.length).toBe(3);

    // November and December should be empty
    expect(
      result.find((m) => m.monthNr === 10 && m.year === 2022)?.entities.length
    ).toBe(0);
    expect(
      result.find((m) => m.monthNr === 11 && m.year === 2022)?.entities.length
    ).toBe(0);

    // January should have 1 entity
    expect(
      result.find((m) => m.monthNr === 0 && m.year === 2023)?.entities.length
    ).toBe(1);
  });

  it('throws error for entities with invalid dates', () => {
    const invalidEntities = [{ id: 1, createdAt: new Date('invalid date') }];

    const from = new Date('2023-01-01');
    const to = new Date('2023-02-01');

    expect(() => {
      groupEntitiesPerMonth(invalidEntities, 'createdAt', from, to);
    }).toThrow();
  });

  it('handles empty entity array', () => {
    const from = new Date('2023-01-01');
    const to = new Date('2023-03-01');
    const result = groupEntitiesPerMonth([], 'createdAt', from, to);

    // Should still have 2 months, just with empty entity arrays
    expect(result.length).toBe(2);
    expect(result[0].entities.length).toBe(0);
    expect(result[1].entities.length).toBe(0);
  });
});

describe('mapToSeries function', () => {
  it('transforms empty map to empty array', () => {
    const dataPointsMap = new Map<string, number[]>();
    const result = mapToSeries(dataPointsMap);
    expect(result).toEqual([]);
  });

  it('transforms single series correctly', () => {
    const dataPointsMap = new Map<string, number[]>();
    dataPointsMap.set('Series A', [10, 20, 30]);

    const result = mapToSeries(dataPointsMap);

    expect(result).toEqual([{ name: 'Series A', values: [10, 20, 30] }]);
  });

  it('transforms multiple series correctly', () => {
    const dataPointsMap = new Map<string, number[]>();
    dataPointsMap.set('Series A', [10, 20, 30]);
    dataPointsMap.set('Series B', [5, 15, 25]);
    dataPointsMap.set('Series C', [1, 2, 3]);

    const result = mapToSeries(dataPointsMap);

    // Check length
    expect(result.length).toBe(3);

    // Check contents (order might vary)
    expect(result).toContainEqual({ name: 'Series A', values: [10, 20, 30] });
    expect(result).toContainEqual({ name: 'Series B', values: [5, 15, 25] });
    expect(result).toContainEqual({ name: 'Series C', values: [1, 2, 3] });
  });

  it('preserves empty values arrays', () => {
    const dataPointsMap = new Map<string, number[]>();
    dataPointsMap.set('Empty Series', []);

    const result = mapToSeries(dataPointsMap);

    expect(result).toEqual([{ name: 'Empty Series', values: [] }]);
  });
});
