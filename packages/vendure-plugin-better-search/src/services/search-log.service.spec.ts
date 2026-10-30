import {
  LanguageCode,
  Logger,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { SearchLogService } from './search-log.service';
import { BetterSearchPlugin } from '../better-search.plugin';

/** Creates a minimal context for storage eligibility tests. */
function context(apiType = 'shop'): RequestContext {
  return {
    apiType,
    channelId: 1,
    languageCode: LanguageCode.en,
  } as RequestContext;
}

/** Creates a log service with isolated database access. */
function fixture(maxLogsPerChannel: number | false = 10_000) {
  const insert = vi.fn().mockResolvedValue({});
  const getRepository = vi.fn().mockReturnValue({ insert });
  const service = new SearchLogService(
    { getRepository } as unknown as TransactionalConnection,
    { maxLogsPerChannel }
  );
  return { service, insert, getRepository };
}

describe('Search log storage', () => {
  it('normalizes terms and stores the supplied total, including zero', async () => {
    const { service, insert } = fixture();
    service.record(context(), '  BLUE\t Shoes  ', 0);
    await Promise.resolve();
    expect(insert).toHaveBeenCalledWith({
      term: 'blue shoes',
      channelId: 1,
      languageCode: LanguageCode.en,
      resultCount: 0,
    });
  });

  it('checks normalized length boundaries', () => {
    const { service, insert } = fixture();
    for (const length of [2, 3, 255, 256])
      service.record(context(), ` ${'A'.repeat(length)} `, 5);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('excludes admin and disabled storage before database access', () => {
    for (const limit of [false, 0] as const) {
      const { service, getRepository } = fixture(limit);
      service.record(context(), 'apple', 1);
      expect(getRepository).not.toHaveBeenCalled();
    }
    const { service, getRepository } = fixture();
    service.record(context('admin'), 'apple', 1);
    expect(getRepository).not.toHaveBeenCalled();
  });

  it('returns immediately and logs rejected inserts once', async () => {
    const { service, insert } = fixture();
    const error = new Error('insert failed');
    insert.mockRejectedValue(error);
    const log = vi.spyOn(Logger, 'error').mockImplementation(() => {});
    expect(service.record(context(), 'apple', 1)).toBeUndefined();
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(1));
    expect(insert).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it('defaults retention and validates configuration', () => {
    const previous = BetterSearchPlugin.options;
    try {
      BetterSearchPlugin.init({});
      expect(BetterSearchPlugin.options.maxLogsPerChannel).toBe(10_000);
      for (const limit of [false, 0, 1, 100_000] as const) {
        expect(() =>
          BetterSearchPlugin.init({ maxLogsPerChannel: limit })
        ).not.toThrow();
      }
      for (const limit of [-1, 1.5, Infinity, NaN]) {
        expect(() =>
          BetterSearchPlugin.init({ maxLogsPerChannel: limit })
        ).toThrow();
      }
    } finally {
      BetterSearchPlugin.options = previous;
    }
  });
});
