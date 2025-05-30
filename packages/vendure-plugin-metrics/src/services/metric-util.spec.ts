import { describe, expect, it } from 'vitest';
import { MetricRequest } from '../entities/metric-request.entity';
import {
  getMonthName,
  getSessions,
  groupEntitiesPerMonth,
  mapToSeries,
  getEntitiesForMonth,
} from './metric-util';

describe('getMonthName()', () => {
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

describe('splitEntitiesInMonths()', () => {
  // Test entities with different date fields
  const testEntities = [
    {
      id: 1,
      createdAt: new Date('2023-01-15T00:00:00Z'),
      updatedAt: new Date('2023-01-20T00:00:00Z'),
      orderPlacedAt: new Date('2023-01-25T00:00:00Z'),
    },
    {
      id: 2,
      createdAt: new Date('2023-02-10T00:00:00Z'),
      updatedAt: new Date('2023-02-15T00:00:00Z'),
      orderPlacedAt: new Date('2023-02-20T00:00:00Z'),
    },
    {
      id: 3,
      createdAt: new Date('2023-02-25T00:00:00Z'),
      updatedAt: new Date('2023-03-05T00:00:00Z'),
      orderPlacedAt: new Date('2023-03-10T00:00:00Z'),
    },
    {
      id: 4,
      createdAt: new Date('2023-04-03T00:00:00Z'),
      updatedAt: new Date('2023-04-02T00:00:00Z'),
      orderPlacedAt: new Date('2023-04-03T00:00:00Z'),
    },
  ];

  it('splits entities by createdAt correctly', () => {
    const from = new Date('2023-01-04T00:00:00Z');
    const to = new Date('2023-03-04T00:00:00Z');
    const result = groupEntitiesPerMonth(testEntities, 'createdAt', from, to);

    // Should have 3 months (Jan, Feb, Mar)
    expect(result.length).toBe(3);

    // January should have 1 entity
    expect(result.find((m) => m.monthNr === 0)?.entities.length).toBe(1);

    // February should have 2 entities
    expect(result.find((m) => m.monthNr === 1)?.entities.length).toBe(2);
  });

  it('splits entities by orderPlacedAt correctly', () => {
    const from = new Date('2023-01-02T00:00:00Z');
    const to = new Date('2023-05-03T00:00:00Z');
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
    expect(
      result.find((m) => m.monthNr === 4 && m.year === 2023)?.entities.length
    ).toBe(0);
  });

  it('includes empty months in the range', () => {
    const from = new Date('2022-11-03T00:00:00Z');
    const to = new Date('2023-02-03T00:00:00Z');
    const result = groupEntitiesPerMonth(testEntities, 'createdAt', from, to);
    // Should have months (Nov, Dec, Jan, Feb)
    expect(result.length).toBe(4);

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

    // February should have 1 entity
    expect(
      result.find((m) => m.monthNr === 1 && m.year === 2023)?.entities.length
    ).toBe(2);
  });

  it('throws error for entities with invalid dates', () => {
    const invalidEntities = [{ id: 1, createdAt: new Date('invalid date') }];

    const from = new Date('2023-01-03T00:00:00Z');
    const to = new Date('2023-02-03T00:00:00Z');

    expect(() => {
      groupEntitiesPerMonth(invalidEntities, 'createdAt', from, to);
    }).toThrow();
  });

  it('handles empty entity array', () => {
    const from = new Date('2023-01-03T00:00:00Z');
    const to = new Date('2023-03-03T00:00:00Z');
    const result = groupEntitiesPerMonth([], 'createdAt', from, to);

    // Should still have 2 months, just with empty entity arrays
    expect(result.length).toBe(3);
    expect(result[0].entities.length).toBe(0);
    expect(result[1].entities.length).toBe(0);
    expect(result[2].entities.length).toBe(0);
  });
});

describe('mapToSeries()', () => {
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

describe('getSessions()', () => {
  // Helper function to create a MetricRequest with the given properties
  function createRequest(
    identifier: string,
    timestamp: Date,
    deviceType: 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown' = 'Desktop'
  ): MetricRequest {
    const request = new MetricRequest();
    request.identifier = identifier;
    request.createdAt = timestamp;
    request.deviceType = deviceType;
    return request;
  }

  it('returns empty array for empty input', () => {
    const sessions = getSessions([], 30);
    expect(sessions).toEqual([]);
  });

  it('creates a single session for a single request', () => {
    const timestamp = new Date('2023-01-03T12:00:00Z');
    const request = createRequest('user1', timestamp);
    const sessions = getSessions([request], 30);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual({
      identifier: 'user1',
      start: timestamp,
      end: timestamp,
      deviceType: 'Desktop',
    });
  });

  it('combines requests within session window into one session', () => {
    const startTime = new Date('2023-01-03T12:00:00Z');
    const fiveMinLater = new Date(startTime.getTime() + 5 * 60 * 1000);
    const tenMinLater = new Date(startTime.getTime() + 10 * 60 * 1000);
    const requests = [
      createRequest('user1', startTime),
      createRequest('user1', fiveMinLater),
      createRequest('user1', tenMinLater),
    ];
    const sessions = getSessions(requests, 30);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual({
      identifier: 'user1',
      start: startTime,
      end: tenMinLater,
      deviceType: 'Desktop',
    });
  });

  it('creates separate sessions for requests outside session window', () => {
    const startTime = new Date('2023-01-03T12:00:00Z');
    const fiveMinLater = new Date(startTime.getTime() + 5 * 60 * 1000);
    const tenMinLater = new Date(startTime.getTime() + 10 * 60 * 1000);
    const requests = [
      createRequest('user1', startTime),
      createRequest('user1', fiveMinLater),
      createRequest('user1', tenMinLater),
    ];
    const sessions = getSessions(requests, 6);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toEqual({
      identifier: 'user1',
      start: startTime,
      end: fiveMinLater,
      deviceType: 'Desktop',
    });
    expect(sessions[1]).toEqual({
      identifier: 'user1',
      start: tenMinLater,
      end: tenMinLater,
      deviceType: 'Desktop',
    });
  });

  it('handles requests from different identifiers as separate sessions', () => {
    const baseTime = new Date('2023-01-03T12:00:00Z');
    const requests = [
      createRequest('user1', baseTime),
      createRequest('user2', baseTime),
      createRequest('user1', new Date(baseTime.getTime() + 5 * 60 * 1000)),
      createRequest('user2', new Date(baseTime.getTime() + 5 * 60 * 1000)),
    ];
    const sessions = getSessions(requests, 30);
    expect(sessions).toHaveLength(2);
    const user1Session = sessions.find((s) => s.identifier === 'user1');
    const user2Session = sessions.find((s) => s.identifier === 'user2');
    expect(user1Session?.start).toEqual(baseTime);
    expect(user1Session?.end).toEqual(
      new Date(baseTime.getTime() + 5 * 60 * 1000)
    );
    expect(user2Session?.start).toEqual(baseTime);
    expect(user2Session?.end).toEqual(
      new Date(baseTime.getTime() + 5 * 60 * 1000)
    );
  });

  it('counts each request as separate session if session length is 0', () => {
    const now = new Date('2023-01-03T12:00:00Z');
    const requests = [
      createRequest('user1', now),
      createRequest('user1', now),
      createRequest('user1', now),
    ];
    const sessions = getSessions(requests, 0);
    expect(sessions).toHaveLength(3);
    expect(sessions[0]).toEqual({
      identifier: 'user1',
      start: now,
      end: now,
      deviceType: 'Desktop',
    });
    expect(sessions[1]).toEqual({
      identifier: 'user1',
      start: now,
      end: now,
      deviceType: 'Desktop',
    });
  });

  it('preserves device type information', () => {
    const baseTime = new Date('2023-01-03T12:00:00Z');
    const requests = [
      createRequest('user1', baseTime, 'Desktop'),
      createRequest('user2', baseTime, 'Mobile'),
      createRequest('user3', baseTime, 'Tablet'),
    ];
    const sessions = getSessions(requests, 30);
    expect(sessions).toHaveLength(3);
    expect(sessions.find((s) => s.identifier === 'user1')?.deviceType).toBe(
      'Desktop'
    );
    expect(sessions.find((s) => s.identifier === 'user2')?.deviceType).toBe(
      'Mobile'
    );
    expect(sessions.find((s) => s.identifier === 'user3')?.deviceType).toBe(
      'Tablet'
    );
  });
});

describe('getEntitiesForMonth()', () => {
  // Test entities with different date fields
  const testEntities = [
    {
      id: 1,
      createdAt: new Date('2023-01-15T00:00:00Z'),
    },
    {
      id: 2,
      createdAt: new Date('2023-02-10T00:00:00Z'),
    },
    {
      id: 3,
      createdAt: new Date('2024-01-25T00:00:00Z'), // Correct month, wrong year
    },
  ];

  it('returns entities for the specified month and year', () => {
    const date = new Date('2023-01-15T00:00:00Z');
    const result = getEntitiesForMonth(testEntities, date, 'createdAt');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns empty array when no entities match the month and year', () => {
    const date = new Date('2023-03-15T00:00:00Z');
    const result = getEntitiesForMonth(testEntities, date, 'createdAt');
    expect(result).toHaveLength(0);
  });

  it('handles empty entity array', () => {
    const date = new Date('2023-01-15T00:00:00Z');
    const result = getEntitiesForMonth([], date, 'createdAt');
    expect(result).toHaveLength(0);
  });
});
