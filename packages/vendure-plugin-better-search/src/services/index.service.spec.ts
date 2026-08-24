import {
  EventBus,
  JobQueueService,
  ProductService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexService } from './index.service';

const mockSerialize = vi.fn().mockReturnValue('serialized-data');
const mockDeserialize = vi.fn().mockReturnValue({ deserialized: true });
const mockGetDocuments = vi.fn().mockResolvedValue([]);
const mockRemoveDocuments = vi.fn().mockResolvedValue({ removed: true });
const mockUpdateDocuments = vi.fn().mockResolvedValue({ updated: true });

vi.mock('../constants', async () => {
  return {
    ...((await vi.importActual('../constants')) as Record<string, unknown>),
    engine: {
      serializeIndex: (index: unknown) => mockSerialize(index),
      deserializeIndex: (data: unknown) => mockDeserialize(data),
      getDocuments: (...args: unknown[]) => mockGetDocuments(...args),
      removeDocuments: (...args: unknown[]) => mockRemoveDocuments(...args),
      updateDocuments: (...args: unknown[]) => mockUpdateDocuments(...args),
    },
  };
});

const mockRequestContext = {
  apiType: 'admin',
  channel: {
    token: 'test-channel',
    availableLanguageCodes: ['en'],
  },
  languageCode: 'en',
  serialize: () => ({}),
} as unknown as RequestContext;

const createMockRepository = (overrides?: {
  findOne?: () => Promise<any>;
  save?: () => Promise<any>;
  channelFind?: () => Promise<any[]>;
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
  const channelRepo = {
    find: vi.fn().mockResolvedValue(overrides?.channelFind?.() ?? []),
  };
  return {
    getRepository: vi.fn().mockReturnValue(repo),
    rawConnection: {
      getRepository: vi.fn().mockReturnValue(channelRepo),
    },
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
    isEnabled?: (ctx: RequestContext) => boolean | Promise<boolean>;
    productService?: ProductService;
    productVariantService?: any;
    eventBus?: EventBus;
  }): IndexService {
    const connection = overrides?.connection ?? createMockRepository();
    const options = {
      debounceIndexRebuildMs: overrides?.debounceMs ?? 50,
      isEnabled: overrides?.isEnabled,
    };
    return new IndexService(
      connection,
      options as any,
      { createQueue: vi.fn() } as unknown as JobQueueService,
      overrides?.productService ?? ({} as ProductService),
      overrides?.productVariantService ?? ({} as any),
      overrides?.eventBus ??
        ({
          ofType: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
        } as unknown as EventBus)
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

    it('throws when no cache and no DB record exists', async () => {
      const connection = createMockRepository();
      const service = createService({ connection });

      await expect(service.getIndex(mockRequestContext)).rejects.toThrow(
        "No index found for channel 'test-channel' (en)"
      );
    });
  });

  describe('updateIndex', () => {
    it('removes affected documents and persists the returned updated index', async () => {
      const connection = createMockRepository();
      const publish = vi.fn().mockResolvedValue(undefined);
      const service = createService({
        connection,
        productService: { findOne: vi.fn() } as unknown as ProductService,
        productVariantService: { findOne: vi.fn() },
        eventBus: { publish } as unknown as EventBus,
      });
      const currentIndex = { current: true };
      (service as any).cachedIndices.set('test-channel-en', {
        index: currentIndex,
        updatedAt: new Date(),
        lastCheckedAt: Date.now(),
      });
      mockGetDocuments.mockResolvedValueOnce([
        { id: 'variant-1', productId: 'product-1' },
      ]);

      const count = await service.updateIndex(mockRequestContext, {
        type: 'partial',
        ctx: {} as any,
        updateProductIds: [],
        updateVariantIds: [],
        removeProductIds: ['product-1'],
        removeVariantIds: [],
      });

      expect(count).toBe(1);
      expect(mockRemoveDocuments).toHaveBeenCalledWith(
        mockRequestContext,
        currentIndex,
        [],
        ['product-1']
      );
      expect(mockUpdateDocuments).toHaveBeenCalledWith(
        mockRequestContext,
        { removed: true },
        []
      );
      expect(mockSerialize).toHaveBeenCalledWith({ updated: true });
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          numberOfProductsIndexed: 1,
          type: 'partial',
        })
      );
    });
  });

  describe('debouncedRebuildIndex', () => {
    it('deduplicates IDs and lets removals take precedence', async () => {
      vi.useFakeTimers();
      const service = createService({ debounceMs: 100 });
      const triggerSpy = vi
        .spyOn(service as any, 'triggerPartialReindex')
        .mockResolvedValue(undefined);

      await service.debouncedRebuildIndex(mockRequestContext, {
        productIds: ['1', '1'],
        variantIds: ['2', '2'],
      });
      await service.debouncedRebuildIndex(mockRequestContext, {
        productIds: ['1'],
        variantIds: ['2'],
        remove: true,
      });
      await service.debouncedRebuildIndex(mockRequestContext, {
        productIds: ['1'],
        variantIds: ['2'],
      });

      await vi.advanceTimersByTimeAsync(100);

      expect(triggerSpy).toHaveBeenCalledTimes(1);
      const batch = triggerSpy.mock.calls[0][0] as any;
      expect([...batch.updateProductIds]).toEqual([]);
      expect([...batch.updateVariantIds]).toEqual([]);
      expect([...batch.removeProductIds]).toEqual(['1']);
      expect([...batch.removeVariantIds]).toEqual(['2']);
    });

    it('creates one partial batch per available language', async () => {
      vi.useFakeTimers();
      const service = createService({ debounceMs: 100 });
      const triggerSpy = vi
        .spyOn(service as any, 'triggerPartialReindex')
        .mockResolvedValue(undefined);
      const ctx = {
        ...mockRequestContext,
        channel: {
          token: 'test-channel',
          availableLanguageCodes: ['en', 'de'],
        },
      } as unknown as RequestContext;

      await service.debouncedRebuildIndex(ctx, { productIds: ['1'] });
      await vi.advanceTimersByTimeAsync(100);

      expect(triggerSpy).toHaveBeenCalledTimes(2);
      expect(
        triggerSpy.mock.calls
          .map(([batch]) => (batch as any).ctx.languageCode)
          .sort()
      ).toEqual(['de', 'en']);
    });

    it('does not queue updates when search is disabled', async () => {
      vi.useFakeTimers();
      const service = createService({
        debounceMs: 100,
        isEnabled: () => false,
      });
      const triggerSpy = vi
        .spyOn(service as any, 'triggerPartialReindex')
        .mockResolvedValue(undefined);

      await service.debouncedRebuildIndex(mockRequestContext, {
        productIds: ['1'],
      });
      await vi.advanceTimersByTimeAsync(100);

      expect(triggerSpy).not.toHaveBeenCalled();
    });

    it('adds full and partial jobs with two retries', async () => {
      vi.useFakeTimers();
      const service = createService({ debounceMs: 100 });
      const add = vi.fn().mockResolvedValue(undefined);
      (service as any).jobQueue = { add };

      await service.triggerReindex(mockRequestContext);
      await service.debouncedRebuildIndex(mockRequestContext, {
        variantIds: ['2'],
      });
      await vi.advanceTimersByTimeAsync(100);

      expect(add).toHaveBeenCalledTimes(2);
      expect(add.mock.calls[0][1]).toEqual({ retries: 2 });
      expect(add.mock.calls[1][1]).toEqual({ retries: 2 });
      expect(add.mock.calls[1][0]).toMatchObject({
        type: 'partial',
        updateVariantIds: ['2'],
      });
    });
  });

  describe('buildMissingIndexes', () => {
    const channelA = {
      id: '1',
      token: 'channel-a',
      availableLanguageCodes: ['en'],
      defaultCurrencyCode: 'USD',
      defaultLanguageCode: 'en',
    };
    const channelB = {
      id: '2',
      token: 'channel-b',
      availableLanguageCodes: ['en', 'de'],
      defaultCurrencyCode: 'USD',
      defaultLanguageCode: 'en',
    };

    it('triggers reindex for channels without existing index', async () => {
      const connection = createMockRepository({
        channelFind: () => Promise.resolve([channelA, channelB]),
      });
      const service = createService({ connection });
      const triggerReindexSpy = vi
        .spyOn(service, 'triggerReindex')
        .mockResolvedValue(undefined as any);

      await (service as any).buildMissingIndexes();

      // Should trigger 3 reindexes: channel-a-en, channel-b-en, channel-b-de
      expect(triggerReindexSpy).toHaveBeenCalledTimes(3);
      triggerReindexSpy.mockRestore();
    });

    it('skips channels where isEnabled returns false', async () => {
      const connection = createMockRepository({
        channelFind: () => Promise.resolve([channelA, channelB]),
      });
      const service = createService({
        connection,
        isEnabled: (ctx: RequestContext) => ctx.channel.token !== 'channel-b',
      });
      const triggerReindexSpy = vi
        .spyOn(service, 'triggerReindex')
        .mockResolvedValue(undefined as any);

      await (service as any).buildMissingIndexes();

      // Should only trigger for channel-a (1 language)
      expect(triggerReindexSpy).toHaveBeenCalledTimes(1);
      triggerReindexSpy.mockRestore();
    });

    it('skips channels where index already exists', async () => {
      const connection = createMockRepository({
        channelFind: () => Promise.resolve([channelA]),
        findOne: () =>
          Promise.resolve({
            id: 'channel-a-en',
            data: 'existing-index',
            updatedAt: new Date(),
          }),
      });
      const service = createService({ connection });
      const triggerReindexSpy = vi
        .spyOn(service, 'triggerReindex')
        .mockResolvedValue(undefined as any);

      await (service as any).buildMissingIndexes();

      // Should not trigger any reindex because index already exists
      expect(triggerReindexSpy).not.toHaveBeenCalled();
      triggerReindexSpy.mockRestore();
    });
  });
});
