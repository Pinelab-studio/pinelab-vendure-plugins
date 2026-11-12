import { ModuleRef } from '@nestjs/core';
import {
  Channel,
  Collection,
  CollectionService,
  EventBus,
  Injector,
  LanguageCode,
  Product,
  ProductService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { ContentCheckResult } from '../entities/content-check-result.entity';
import { ContentCheckMessage, ContentHealthPluginOptions } from '../types';
import { ContentCheckService } from './content-check.service';
import { ContentCheckResultService } from './content-check-result.service';
import { SitemapFetcher } from './sitemap-fetcher';
import {
  PageFetchResult,
  StorefrontPageFetcher,
} from './storefront-page-fetcher';

function createService(options: ContentHealthPluginOptions) {
  const saveResult = vi.fn(
    (
      _ctx: RequestContext,
      input: { messages: ContentCheckMessage[] },
    ): Promise<ContentCheckResult> =>
      Promise.resolve({
        ...input,
        id: '1',
      } as unknown as ContentCheckResult),
  );
  const resultService = { saveResult } as unknown as ContentCheckResultService;

  const fetch = vi.fn(
    (_url: string): Promise<PageFetchResult> =>
      Promise.resolve({ ok: false, error: 'not used in this test' }),
  );
  const pageFetcher = { fetch } as unknown as StorefrontPageFetcher;

  const sitemapFetcher = { fetch: vi.fn() } as unknown as SitemapFetcher;

  const service = new ContentCheckService(
    undefined as unknown as TransactionalConnection, // unused by checkEntity
    undefined as unknown as ProductService, // unused by checkEntity
    undefined as unknown as CollectionService, // unused by checkEntity
    undefined as unknown as EventBus, // unused by checkEntity
    pageFetcher,
    sitemapFetcher,
    resultService,
    undefined as unknown as ModuleRef, // unused by checkEntity
    options,
  );
  return { service, saveResult, fetch };
}

const channel = {
  id: '1',
  code: 'default',
  availableLanguageCodes: [LanguageCode.en],
  defaultLanguageCode: LanguageCode.en,
} as unknown as Channel;
const ctx = {} as unknown as RequestContext;

function createEntity(): Product | Collection {
  return { id: '10' } as unknown as Product;
}

describe('ContentCheckService.checkEntity', () => {
  it('replaces results with a warning when shouldCheckEntity rejects the entity and skips all other checks', async () => {
    const shouldCheckEntity = vi.fn(() => false);
    const getProductUrl = vi.fn();
    const configurableCheck = vi.fn();
    const { service, saveResult, fetch } = createService({
      getProductUrl,
      getCollectionUrl: vi.fn(),
      shouldCheckEntity,
      checks: { product: [configurableCheck] },
    });

    const result = await service.checkEntity(
      ctx,
      'product',
      createEntity(),
      channel,
      LanguageCode.en,
    );

    expect(result).toBeDefined();
    expect(saveResult).toHaveBeenCalledOnce();
    expect(saveResult.mock.calls[0][1].messages).toEqual([
      {
        source: 'entity-eligibility',
        severity: 'warning',
        code: 'ENTITY_EXCLUDED',
        message: 'This entity is excluded from content checks.',
      },
    ]);
    expect(shouldCheckEntity).toHaveBeenCalledOnce();
    expect(getProductUrl).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(configurableCheck).not.toHaveBeenCalled();
  });

  it('checks an entity as normal when shouldCheckEntity is not configured', async () => {
    const { service, saveResult } = createService({
      getProductUrl: vi.fn(() => Promise.resolve(undefined)),
      getCollectionUrl: vi.fn(),
    });

    const result = await service.checkEntity(
      ctx,
      'product',
      createEntity(),
      channel,
      LanguageCode.en,
    );

    expect(result).toBeDefined();
    expect(saveResult).toHaveBeenCalledTimes(1);
  });

  it('passes the server-rendered HTML to validateStorefront and stores only its findings', async () => {
    // No title, description, hreflang or JSON-LD: the 0.2.x built-in checks would flag all of them.
    const html = '<html><head></head><body>Server HTML</body></html>';
    const finding: ContentCheckMessage = {
      source: 'storefront',
      severity: 'error',
      code: 'CUSTOM_RULE',
      message: 'Custom rule failed',
    };
    const validateStorefront = vi.fn(() => [finding]);
    const entity = createEntity();
    const { service, saveResult, fetch } = createService({
      getProductUrl: () => 'https://shop.test/en/p',
      getCollectionUrl: vi.fn(),
      validateStorefront,
    });
    fetch.mockResolvedValue({
      ok: true,
      html,
      finalUrl: 'https://shop.test/en/p/',
    });

    await service.checkEntity(ctx, 'product', entity, channel, LanguageCode.en);

    expect(validateStorefront).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        entityType: 'product',
        entity,
        channel,
        languageCode: LanguageCode.en,
        url: 'https://shop.test/en/p',
        finalUrl: 'https://shop.test/en/p/',
        html,
      }),
    );
    expect(saveResult.mock.calls[0][1].messages).toEqual([finding]);
  });

  it('requests each page fetched by validateStorefront only once per scan', async () => {
    const { service, fetch } = createService({
      getProductUrl: () => 'https://shop.test/en/p',
      getCollectionUrl: vi.fn(),
      validateStorefront: async (_ctx, { fetchPage }) => {
        await fetchPage('https://shop.test/en/linked');
        await fetchPage('https://shop.test/en/linked');
        return [];
      },
    });
    fetch.mockResolvedValue({ ok: true, html: '', finalUrl: '' });
    const sitemapCache = new Map();
    const pageCache = new Map();

    for (let i = 0; i < 2; i++) {
      await service.checkEntity(
        ctx,
        'product',
        createEntity(),
        channel,
        LanguageCode.en,
        sitemapCache,
        pageCache,
      );
    }

    const linkedRequests = fetch.mock.calls.filter(
      ([url]) => url === 'https://shop.test/en/linked',
    );
    expect(linkedRequests).toHaveLength(1);
  });

  it('runs no HTML validation when validateStorefront is not configured', async () => {
    const { service, saveResult, fetch } = createService({
      getProductUrl: () => 'https://shop.test/en/p',
      getCollectionUrl: vi.fn(),
    });
    fetch.mockResolvedValue({
      ok: true,
      html: '<html><head></head><body></body></html>',
      finalUrl: 'https://shop.test/en/p',
    });

    await service.checkEntity(
      ctx,
      'product',
      createEntity(),
      channel,
      LanguageCode.en,
    );

    expect(saveResult.mock.calls[0][1].messages).toEqual([]);
  });

  it('passes an Injector to product checks, so they can query Vendure data', async () => {
    const productCheck = vi.fn((): ContentCheckMessage[] => []);
    const { service } = createService({
      getProductUrl: () => undefined,
      getCollectionUrl: vi.fn(),
      checks: { product: [productCheck] },
    });

    await service.checkEntity(
      ctx,
      'product',
      createEntity(),
      channel,
      LanguageCode.en,
    );

    expect(productCheck).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ injector: expect.any(Injector) }),
    );
  });

  it('turns a thrown configurable check into a single internal error, without stopping the remaining checks', async () => {
    const throwingCheck = vi.fn(() => {
      throw new Error('boom');
    });
    const passingCheck = vi.fn((): ContentCheckMessage[] => [
      { source: 'demo', severity: 'warning', code: 'DEMO', message: 'ok' },
    ]);
    const { service, saveResult } = createService({
      // Forces URL_UNRESOLVABLE, so the page fetch is skipped.
      getProductUrl: vi.fn(() => Promise.resolve(undefined)),
      getCollectionUrl: vi.fn(),
      checks: { product: [throwingCheck, passingCheck] },
    });

    await service.checkEntity(
      ctx,
      'product',
      createEntity(),
      channel,
      LanguageCode.en,
    );

    expect(throwingCheck).toHaveBeenCalledTimes(1);
    expect(passingCheck).toHaveBeenCalledTimes(1);

    const savedInput = saveResult.mock.calls[0][1];
    const internalErrors = savedInput.messages.filter(
      (m) => m.code === 'INTERNAL_CHECK_ERROR',
    );
    expect(internalErrors).toHaveLength(1);
    expect(savedInput.messages.some((m) => m.code === 'DEMO')).toBe(true);
  });
});
