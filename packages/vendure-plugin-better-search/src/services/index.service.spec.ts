import {
  Channel,
  ConfigService,
  ImportParser,
  LanguageCode,
  Logger,
  Product,
  ProductVariant,
  EventBus,
  JobQueueService,
  ProductService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IndexService } from './index.service';
import { BetterSearchDocument, IndexJobData } from '../types';
import { SearchService } from './search.service';

const mockSearch = vi.fn();
const mockSerialize = vi.fn().mockReturnValue('serialized-data');
const mockDeserialize = vi.fn().mockReturnValue({ deserialized: true });
const mockGetDocuments = vi.fn().mockResolvedValue([]);
const mockRemoveDocuments = vi.fn().mockResolvedValue({ removed: true });
const mockUpdateDocuments = vi.fn().mockResolvedValue({ updated: true });

vi.mock('../constants', async () => {
  return {
    ...((await vi.importActual('../constants')) as Record<string, unknown>),
    engine: {
      search: (...args: unknown[]) => mockSearch(...args),
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
  find?: () => Promise<Array<{ id: string; data: string }>>;
  channelFind?: () => Promise<any[]>;
}) => {
  const repo = {
    find: vi.fn().mockResolvedValue([]),
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

  describe('serialized index size logging', () => {
    it('logs MB per index and totals, replacing previous sizes without rereading all data', async () => {
      const find = vi.fn().mockResolvedValue([
        { id: 'test-channel-en', data: 'old' },
        { id: 'another-channel-en', data: 'x'.repeat(2_000_000) },
      ]);
      const service = createService({
        connection: createMockRepository({ find }),
      });
      const log = vi.spyOn(Logger, 'info').mockImplementation(() => undefined);
      const sizes = service as unknown as {
        logIndexSizes(
          ctx: RequestContext,
          key: string,
          serialized: string
        ): Promise<void>;
      };
      try {
        await sizes.logIndexSizes(
          mockRequestContext,
          'test-channel-en',
          'x'.repeat(1_000_000)
        );
        expect(log).toHaveBeenLastCalledWith(
          "Index 'test-channel-en' size: 1.00 MB; total across 2 stored indexes: 3.00 MB (serialized)",
          expect.any(String)
        );
        await sizes.logIndexSizes(
          mockRequestContext,
          'test-channel-en',
          'x'.repeat(4_000_000)
        );
        expect(log).toHaveBeenLastCalledWith(
          "Index 'test-channel-en' size: 4.00 MB; total across 2 stored indexes: 6.00 MB (serialized)",
          expect.any(String)
        );
        expect(find).toHaveBeenCalledTimes(1);
      } finally {
        log.mockRestore();
      }
    });
  });

  describe('development catalog CSV', () => {
    it('parses repeated product rows as variants, including Perliet', async () => {
      const parser = new ImportParser({
        defaultLanguageCode: LanguageCode.en,
        customFields: { Product: [], ProductVariant: [] },
      } as unknown as ConfigService);
      const result = await parser.parseProducts(
        readFileSync(resolve('test/wkw-products.csv'), 'utf8')
      );
      expect(result.errors).toEqual([]);
      expect(result.results).toHaveLength(284);
      expect(
        result.results.reduce(
          (count, product) => count + product.variants.length,
          0
        )
      ).toBe(373);
      const perliet = result.results.filter(
        ({ product }) => product.translations[0].slug === 'perliet'
      );
      expect(perliet).toHaveLength(1);
      expect(
        perliet[0].variants.map(
          (variant) => variant.translations[0].optionValues
        )
      ).toEqual([['2 liter'], ['10 liter'], ['25 liter'], ['1000 liter']]);
      for (const { product, variants } of result.results) {
        const combinations = variants.map((variant) => {
          expect(variant.translations[0].optionValues).toHaveLength(
            product.optionGroups.length
          );
          return variant.translations[0].optionValues.join('|');
        });
        expect(new Set(combinations).size).toBe(variants.length);
      }
    });
  });

  describe('SearchService product grouping', () => {
    /** Creates a minimal indexed variant document for grouping tests. */
    function document(
      id: string,
      productId: string,
      price: number,
      score: number
    ): BetterSearchDocument {
      return {
        productVariantId: id,
        productVariantName: id,
        productId,
        productName: productId,
        sku: id,
        slug: productId,
        description: '',
        lowestPrice: price,
        highestPrice: price,
        lowestPriceWithTax: price * 1.2,
        highestPriceWithTax: price * 1.2,
        score,
        facetIds: [],
        facetValueIds: [id],
        collectionIds: [id],
        collectionNames: [id],
      };
    }

    /** Provides search results without requiring a persisted index. */
    function searchService(): SearchService {
      const indexService = createService();
      vi.spyOn(indexService, 'getIndex').mockResolvedValue({});
      mockSearch.mockResolvedValue([
        document('v1', 'p1', 100, 10),
        document('v2', 'p1', 200, 8),
        document('v3', 'p2', 50, 5),
      ]);
      return new SearchService(indexService, {});
    }

    it('returns one result per product with combined price ranges and memberships', async () => {
      const result = await searchService().search(mockRequestContext, {
        term: 'test',
        groupByProduct: true,
      });
      expect(result.totalItems).toBe(2);
      expect(result.items.map((item) => item.productId)).toEqual(['p1', 'p2']);
      expect(result.items[0]).toMatchObject({
        productVariantId: 'v1',
        score: 10,
        price: { min: 100, max: 200 },
        priceWithTax: { min: 120, max: 240 },
        facetValueIds: ['v1', 'v2'],
        collectionIds: ['v1', 'v2'],
      });
    });

    it.each([false, undefined])(
      'preserves variant results when grouping is %s',
      async (groupByProduct) => {
        const result = await searchService().search(mockRequestContext, {
          term: 'test',
          groupByProduct,
        });
        expect(result.totalItems).toBe(3);
        expect(result.items.map((item) => item.productVariantId)).toEqual([
          'v1',
          'v2',
          'v3',
        ]);
      }
    );

    it('paginates after grouping and counts all matching products', async () => {
      const result = await searchService().search(mockRequestContext, {
        term: 'test',
        groupByProduct: true,
        skip: 1,
        take: 1,
      });
      expect(result.totalItems).toBe(2);
      expect(result.items.map((item) => item.productId)).toEqual(['p2']);
    });
  });

  describe('partial regression coverage', () => {
    /** Creates a removal payload without relying on private service state. */
    function removal(): Extract<IndexJobData, { type: 'partial' }> {
      return {
        type: 'partial',
        ctx: mockRequestContext.serialize(),
        updateProductIds: [],
        updateVariantIds: [],
        removeProductIds: ['1'],
        removeVariantIds: [],
      };
    }

    it('enqueues the public payload unchanged with retries', async () => {
      const add = vi.fn().mockResolvedValue({ id: 'job' });
      const service = createService();
      Object.assign(service, { jobQueue: { add } });
      const data = removal();
      expect(await service.triggerPartialReindex(data)).toEqual({ id: 'job' });
      expect(add).toHaveBeenCalledWith(data, { retries: 2 });
    });

    it.each([
      { enabled: false, deletedAt: null, channels: [{ id: undefined }] },
      { enabled: true, deletedAt: new Date(), channels: [{ id: undefined }] },
      { enabled: true, deletedAt: null, channels: [{ id: 'other' }] },
    ])(
      'excludes disabled, deleted or unassigned products: %j',
      async (product) => {
        const service = createService({
          connection: createMockRepository({
            findOne: vi.fn().mockResolvedValue({ data: 'stored' }),
          }),
          productService: {
            findOne: vi.fn().mockResolvedValue(product),
          } as unknown as ProductService,
          eventBus: {
            publish: vi.fn().mockResolvedValue(undefined),
          } as unknown as EventBus,
        });
        await service.updateIndex(mockRequestContext, {
          ...removal(),
          removeProductIds: [],
          updateProductIds: ['1'],
        });
        expect(mockUpdateDocuments).toHaveBeenLastCalledWith(
          mockRequestContext,
          { removed: true },
          []
        );
      }
    );

    it('skips deletion fallback languages without an existing index', async () => {
      vi.useFakeTimers();
      const service = createService();
      const enqueue = vi.spyOn(service, 'triggerPartialReindex');
      await service.debouncedRebuildIndex(
        mockRequestContext,
        { productIds: ['1'], remove: true },
        true
      );
      await vi.advanceTimersByTimeAsync(100);
      expect(enqueue).not.toHaveBeenCalled();
    });

    it('fails partial jobs when the index is missing', async () => {
      await expect(
        createService().updateIndex(mockRequestContext, removal())
      ).rejects.toThrow('No index found');
    });

    it('serializes writes and recovers after a failed save', async () => {
      const save = vi
        .fn()
        .mockRejectedValueOnce(new Error('save failed'))
        .mockResolvedValue({ updatedAt: new Date() });
      const connection = createMockRepository({
        findOne: vi.fn().mockResolvedValue({ data: 'stored' }),
        save,
      });
      const service = createService({
        connection,
        eventBus: {
          publish: vi.fn().mockResolvedValue(undefined),
        } as unknown as EventBus,
      });
      const first = service.updateIndex(mockRequestContext, removal());
      const second = service.updateIndex(mockRequestContext, removal());
      await expect(first).rejects.toThrow('save failed');
      await expect(second).resolves.toBe(0);
      expect(save).toHaveBeenCalledTimes(2);
      expect(mockDeserialize).toHaveBeenCalledWith('stored');
    });

    it('routes updates to assigned channels and deletion fallback to all channels', async () => {
      const channels = [
        { id: '1', token: 'one', availableLanguageCodes: ['en'] },
        { id: '2', token: 'two', availableLanguageCodes: ['en', 'de'] },
      ];
      const findOne = vi.fn().mockResolvedValue({ channels: [channels[1]] });
      const connection = {
        getRepository: vi.fn((_, entity) =>
          entity === Channel
            ? { find: vi.fn().mockResolvedValue(channels) }
            : entity === Product || entity === ProductVariant
            ? { findOne }
            : {}
        ),
      } as unknown as TransactionalConnection;
      const service = createService({ connection });
      const debounce = vi
        .spyOn(service, 'debouncedRebuildIndex')
        .mockResolvedValue(undefined);
      await service.reindexAffectedChannels(mockRequestContext, {
        productIds: ['1'],
      });
      expect(debounce).toHaveBeenCalledTimes(1);
      expect(debounce.mock.calls[0][0].channel.token).toBe('two');
      debounce.mockClear();
      findOne.mockResolvedValue(undefined);
      await service.reindexAffectedChannels(mockRequestContext, {
        variantIds: ['2'],
        remove: true,
      });
      expect(debounce).toHaveBeenCalledTimes(2);
      expect(debounce.mock.calls.every((call) => call[2] === true)).toBe(true);
    });

    it('does not resurrect a variant belonging to a removed product', async () => {
      const findOne = vi.fn().mockResolvedValue({
        id: 'v',
        productId: '1',
        enabled: true,
        channels: [{ id: undefined }],
        product: { enabled: true, channels: [{ id: undefined }] },
      });
      const service = createService({
        connection: createMockRepository({
          findOne: vi.fn().mockResolvedValue({ data: 'stored' }),
        }),
        productVariantService: { findOne },
        eventBus: {
          publish: vi.fn().mockResolvedValue(undefined),
        } as unknown as EventBus,
      });
      await service.updateIndex(mockRequestContext, {
        ...removal(),
        updateVariantIds: ['v'],
      });
      expect(mockUpdateDocuments).toHaveBeenLastCalledWith(
        mockRequestContext,
        { removed: true },
        []
      );
    });
  });

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
      const connection = createMockRepository({
        findOne: vi.fn().mockResolvedValue({ data: 'stored' }),
      });
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
        { deserialized: true },
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
          .map(([batch]) => (batch as any).ctx._languageCode)
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
