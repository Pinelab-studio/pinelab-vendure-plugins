import {
  CacheService,
  ConfigService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { BetterSearchPlugin } from '../better-search.plugin';
import {
  SearchLogAggregationService,
  splitAggregateFilter,
} from './search-log-aggregation.service';

/** Creates a small SQL-builder fixture to verify caching without a running server. */
function fixture(ttl = 60) {
  const query = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    setParameters: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
    getQuery: vi.fn().mockReturnValue('SELECT logs'),
    getParameters: vi.fn().mockReturnValue({}),
    getRawOne: vi.fn().mockResolvedValue({ count: 0 }),
    getRawMany: vi.fn().mockResolvedValue([]),
  };
  const repository = {
    createQueryBuilder: vi.fn(() => query),
    manager: {
      createQueryBuilder: vi.fn(() => query),
      connection: {
        options: { type: 'sqljs' },
        driver: { escape: (name: string) => `"${name}"` },
      },
    },
  };
  const cache = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };
  const connection = { getRepository: vi.fn(() => repository) };
  const config = { apiOptions: { adminListQueryLimit: 100 } };
  const service = new SearchLogAggregationService(
    connection as unknown as TransactionalConnection,
    cache as unknown as CacheService,
    config as ConfigService,
    { searchLogAggregationCacheTtlSeconds: ttl }
  );
  const ctx = { channelId: 1 } as RequestContext;
  return { service, cache, connection, ctx };
}

describe('Search log aggregation', () => {
  it('uses cached responses without querying SQL', async () => {
    const { service, cache, connection, ctx } = fixture();
    cache.get.mockResolvedValue({ items: [], totalItems: 0 });
    expect(await service.findAll(ctx)).toEqual({ items: [], totalItems: 0 });
    expect(connection.getRepository).not.toHaveBeenCalled();
  });

  it('uses milliseconds and separates cache keys by options and channel', async () => {
    const { service, cache, ctx } = fixture(12);
    await service.findAll(ctx, { take: 1 });
    await service.findAll(ctx, { take: 2 });
    await service.findAll({ channelId: 2 } as RequestContext, { take: 1 });
    expect(cache.set.mock.calls[0][2]).toEqual({ ttl: 12000 });
    expect(new Set(cache.get.mock.calls.map(([key]) => key)).size).toBe(3);
  });

  it('bypasses caching when TTL is zero', async () => {
    const { service, cache, ctx } = fixture(0);
    await service.findAll(ctx);
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('validates pagination before cache access', async () => {
    const { service, cache, ctx } = fixture();
    for (const take of [-1, 0.5, 101])
      await expect(service.findAll(ctx, { take })).rejects.toThrow(
        'pagination'
      );
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('validates TTL and supplies its default', () => {
    for (const ttl of [-1, 0.5, Infinity, NaN])
      expect(() =>
        BetterSearchPlugin.init({ searchLogAggregationCacheTtlSeconds: ttl })
      ).toThrow('searchLogAggregationCacheTtlSeconds');
    BetterSearchPlugin.init({});
    expect(BetterSearchPlugin.options.searchLogAggregationCacheTtlSeconds).toBe(
      60
    );
  });

  it('splits AND filters and rejects mixed date/aggregate OR', () => {
    const date = { lastSearchedAt: { before: '2021-01-01' } };
    const aggregate = { resultCount: { lt: 5 } };
    expect(splitAggregateFilter({ _and: [date, aggregate] })).toEqual([
      { _and: [date] },
      { _and: [aggregate] },
    ]);
    expect(() => splitAggregateFilter({ _or: [date, aggregate] })).toThrow(
      'cannot be combined'
    );
  });
});
