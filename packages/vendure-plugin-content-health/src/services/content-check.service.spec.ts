import { ModuleRef } from '@nestjs/core';
import {
  Channel,
  Collection,
  CollectionService,
  EventBus,
  LanguageCode,
  Product,
  ProductService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { ContentCheckMessage, ContentHealthPluginOptions } from '../types';
import { ContentCheckResult } from '../entities/content-check-result.entity';
import { ContentCheckResultService } from './content-check-result.service';
import { ContentCheckService } from './content-check.service';
import { SitemapFetcher } from './sitemap-fetcher';
import {
  PageFetchResult,
  StorefrontPageFetcher,
} from './storefront-page-fetcher';

function createService(options: ContentHealthPluginOptions) {
  const saveResult = vi.fn(
    (
      ctx: RequestContext,
      input: { messages: ContentCheckMessage[] }
    ): Promise<ContentCheckResult> =>
      Promise.resolve({
        ...input,
        id: '1',
      } as unknown as ContentCheckResult)
  );
  const resultService = { saveResult } as unknown as ContentCheckResultService;

  const fetch = vi.fn(
    (): Promise<PageFetchResult> =>
      Promise.resolve({ ok: false, error: 'not used in this test' })
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
    options
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
      LanguageCode.en
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
      LanguageCode.en
    );

    expect(result).toBeDefined();
    expect(saveResult).toHaveBeenCalledTimes(1);
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
      LanguageCode.en
    );

    expect(throwingCheck).toHaveBeenCalledTimes(1);
    expect(passingCheck).toHaveBeenCalledTimes(1);

    const savedInput = saveResult.mock.calls[0][1];
    const internalErrors = savedInput.messages.filter(
      (m) => m.code === 'INTERNAL_CHECK_ERROR'
    );
    expect(internalErrors).toHaveLength(1);
    expect(savedInput.messages.some((m) => m.code === 'DEMO')).toBe(true);
  });
});
