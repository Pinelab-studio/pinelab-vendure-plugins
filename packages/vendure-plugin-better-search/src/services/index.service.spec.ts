import {
  EventBus,
  JobQueueService,
  ProductService,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexService } from './index.service';

const mockSerialize = vi.fn().mockReturnValue('serialized-data');
const mockDeserialize = vi.fn().mockReturnValue({ deserialized: true });

vi.mock('../constants', async () => {
  return {
    ...((await vi.importActual('../constants')) as Record<string, unknown>),
    engine: {
      serializeIndex: () => mockSerialize(),
      deserializeIndex: (data: unknown) => mockDeserialize(data),
    },
  };
});

const mockRequestContext = {
  channel: { token: 'test-channel' },
  languageCode: 'en',
  serialize: () => ({}),
} as unknown as RequestContext;

const createMockRepository = (overrides?: {
  findOne?: () => Promise<any>;
  save?: () => Promise<any>;
}) => {
  const repo = {
    findOne: vi.fn().mockResolvedValue(undefined),
    save: vi
      .fn()
      .mockImplementation((entity) =>
        Promise.resolve({ ...entity, updatedAt: new Date() })
      ),
    ...overrides,
  };
  return {
    getRepository: vi.fn().mockReturnValue(repo),
  } as unknown as TransactionalConnection;
};

describe('IndexService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function createService(overrides?: {
    connection?: TransactionalConnection;
    debounceMs?: number;
  }): IndexService {
    const connection = overrides?.connection ?? createMockRepository();
    const options = { debounceIndexRebuildMs: overrides?.debounceMs ?? 50 };
    return new IndexService(
      connection,
      options as any,
      { createQueue: vi.fn() } as unknown as JobQueueService,
      {} as ProductService,
      {} as ProductVariantService,
      {
        ofType: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      } as unknown as EventBus,
      {} as any
    );
  }

  describe('getIndex', () => {
    it('returns cached index when TTL is valid', async () => {
      const service = createService();
      const mockBuildIndex = vi
        .spyOn(service, 'buildIndex')
        .mockResolvedValue(5);

      const cachedIndex = { my: 'index' };
      (service as any).cachedIndices.set('test-channel-en', {
        index: cachedIndex,
        updatedAt: new Date(),
        lastCheckedAt: Date.now(),
      });

      const result = await service.getIndex(mockRequestContext);

      expect(result).toBe(cachedIndex);
      expect(mockBuildIndex).not.toHaveBeenCalled();
      mockBuildIndex.mockRestore();
    });

    it('returns cached index when ignoreCacheTtl is true even if TTL expired', async () => {
      const service = createService();
      const mockBuildIndex = vi
        .spyOn(service, 'buildIndex')
        .mockResolvedValue(5);

      const cachedIndex = { my: 'index' };
      (service as any).cachedIndices.set('test-channel-en', {
        index: cachedIndex,
        updatedAt: new Date('2024-01-01'),
        lastCheckedAt: Date.now() - 20_000,
      });

      const result = await service.getIndex(mockRequestContext, true);

      expect(result).toBe(cachedIndex);
      expect(mockBuildIndex).not.toHaveBeenCalled();
      mockBuildIndex.mockRestore();
    });

    it('returns cached index when TTL expired but DB updatedAt is older', async () => {
      const dbDate = new Date('2024-01-01');
      const cacheDate = new Date('2024-02-01');

      const connection = createMockRepository({
        findOne: vi.fn().mockResolvedValue({ updatedAt: dbDate }),
      });
      const service = createService({ connection });
      const mockBuildIndex = vi
        .spyOn(service, 'buildIndex')
        .mockResolvedValue(5);

      (service as any).cachedIndices.set('test-channel-en', {
        index: { my: 'index' },
        updatedAt: cacheDate,
        lastCheckedAt: Date.now() - 20_000,
      });

      const result = await service.getIndex(mockRequestContext);

      expect(result).toEqual({ my: 'index' });
      expect(mockBuildIndex).not.toHaveBeenCalled();
      mockBuildIndex.mockRestore();
    });

    it('loads fresh record when TTL expired and DB updatedAt is newer', async () => {
      const cacheDate = new Date('2024-01-01');
      const dbDate = new Date('2024-02-01');

      const connection = createMockRepository({
        findOne: vi.fn().mockImplementation((args) => {
          if (args?.select?.includes('updatedAt')) {
            return Promise.resolve({ updatedAt: dbDate });
          }
          return Promise.resolve({
            id: 'test-channel-en',
            data: 'fresh-data',
            updatedAt: dbDate,
          });
        }),
      });
      const service = createService({ connection });
      const mockBuildIndex = vi
        .spyOn(service, 'buildIndex')
        .mockResolvedValue(5);

      (service as any).cachedIndices.set('test-channel-en', {
        index: { my: 'old-index' },
        updatedAt: cacheDate,
        lastCheckedAt: Date.now() - 20_000,
      });

      const result = await service.getIndex(mockRequestContext);

      expect(result).toEqual({ deserialized: true });
      expect(mockBuildIndex).not.toHaveBeenCalled();
      expect(mockDeserialize).toHaveBeenCalledWith('fresh-data');
      mockBuildIndex.mockRestore();
    });

    it('loads from DB when no cache exists', async () => {
      const dbDate = new Date('2024-03-01');
      const connection = createMockRepository({
        findOne: vi.fn().mockResolvedValue({
          id: 'test-channel-en',
          data: 'db-data',
          updatedAt: dbDate,
        }),
      });
      const service = createService({ connection });
      const mockBuildIndex = vi
        .spyOn(service, 'buildIndex')
        .mockResolvedValue(5);

      const result = await service.getIndex(mockRequestContext);

      expect(result).toEqual({ deserialized: true });
      expect(mockDeserialize).toHaveBeenCalledWith('db-data');
      expect(mockBuildIndex).not.toHaveBeenCalled();

      // Verify cache was populated
      const cached = (service as any).cachedIndices.get('test-channel-en');
      expect(cached.index).toEqual({ deserialized: true });
      expect(cached.updatedAt).toEqual(dbDate);
      mockBuildIndex.mockRestore();
    });

    it('calls buildIndex when no cache and no DB record', async () => {
      const connection = createMockRepository();
      const service = createService({ connection });
      const builtIndex = { built: 'index' };
      const mockBuildIndex = vi
        .spyOn(service, 'buildIndex')
        .mockImplementation(async () => {
          (service as any).cachedIndices.set('test-channel-en', {
            index: builtIndex,
            updatedAt: new Date(),
            lastCheckedAt: Date.now(),
          });
          return 1;
        });

      const result = await service.getIndex(mockRequestContext);

      expect(result).toBe(builtIndex);
      expect(mockBuildIndex).toHaveBeenCalledWith(mockRequestContext);
      mockBuildIndex.mockRestore();
    });

    it('throws if buildIndex fails to populate cache', async () => {
      const connection = createMockRepository();
      const service = createService({ connection });
      const mockBuildIndex = vi
        .spyOn(service, 'buildIndex')
        .mockResolvedValue(0);

      await expect(service.getIndex(mockRequestContext)).rejects.toThrow(
        'Index not found for test-channel-en'
      );
      mockBuildIndex.mockRestore();
    });
  });

  describe('debouncedRebuildIndex', () => {
    it('triggers exactly one reindex for multiple calls within debounce window', async () => {
      vi.useFakeTimers();
      const service = createService({ debounceMs: 100 });
      const triggerReindexSpy = vi
        .spyOn(service, 'triggerReindex')
        .mockResolvedValue(undefined as any);

      // Call 3 times rapidly
      const p1 = service.debouncedRebuildIndex(mockRequestContext);
      const p2 = service.debouncedRebuildIndex(mockRequestContext);
      const p3 = service.debouncedRebuildIndex(mockRequestContext);

      vi.advanceTimersByTime(100);
      await Promise.all([p1, p2, p3]);

      expect(triggerReindexSpy).toHaveBeenCalledTimes(1);
      expect(triggerReindexSpy).toHaveBeenCalledWith(mockRequestContext);
      triggerReindexSpy.mockRestore();
    });

    it('triggers one reindex per different key', async () => {
      vi.useFakeTimers();
      const service = createService({ debounceMs: 100 });
      const triggerReindexSpy = vi
        .spyOn(service, 'triggerReindex')
        .mockResolvedValue(undefined as any);

      const ctx1 = {
        channel: { token: 'channel-a' },
        languageCode: 'en',
      } as unknown as RequestContext;
      const ctx2 = {
        channel: { token: 'channel-b' },
        languageCode: 'en',
      } as unknown as RequestContext;

      const p1 = service.debouncedRebuildIndex(ctx1);
      const p2 = service.debouncedRebuildIndex(ctx2);

      vi.advanceTimersByTime(100);
      await Promise.all([p1, p2]);

      expect(triggerReindexSpy).toHaveBeenCalledTimes(2);
      expect(triggerReindexSpy).toHaveBeenCalledWith(ctx1);
      expect(triggerReindexSpy).toHaveBeenCalledWith(ctx2);
      triggerReindexSpy.mockRestore();
    });

    it('triggers additional reindex after debounce window passes', async () => {
      vi.useFakeTimers();
      const service = createService({ debounceMs: 50 });
      const triggerReindexSpy = vi
        .spyOn(service, 'triggerReindex')
        .mockResolvedValue(undefined as any);

      const p1 = service.debouncedRebuildIndex(mockRequestContext);
      vi.advanceTimersByTime(50);
      await p1;

      expect(triggerReindexSpy).toHaveBeenCalledTimes(1);

      const p2 = service.debouncedRebuildIndex(mockRequestContext);
      vi.advanceTimersByTime(50);
      await p2;

      expect(triggerReindexSpy).toHaveBeenCalledTimes(2);
      triggerReindexSpy.mockRestore();
    });
  });
});
