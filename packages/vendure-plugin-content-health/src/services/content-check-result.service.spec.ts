import { RequestContext, TransactionalConnection } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { ContentCheckResult } from '../entities/content-check-result.entity';
import { ContentCheckResultService } from './content-check-result.service';

interface FakeFindOneOptions {
  where: Record<string, unknown>;
}

/**
 * A minimal in-memory stand-in for `TransactionalConnection.getRepository`,
 * just enough to exercise the atomic upsert pattern without a real database.
 */
function createFakeConnection() {
  const rows: ContentCheckResult[] = [];
  let nextId = 1;
  function findMatching(where: Record<string, unknown>) {
    return rows.find(
      (r) =>
        r.entityType === where.entityType &&
        String(r.entityId) === String(where.entityId) &&
        String(r.channelId) === String(where.channelId) &&
        r.languageCode === where.languageCode
    );
  }
  let queryChannelId: string | undefined;
  const queryBuilder = {
    where: (_condition: string, params: { channelId: string }) => {
      queryChannelId = params.channelId;
      return queryBuilder;
    },
    andWhere: () => queryBuilder,
    orderBy: () => queryBuilder,
    addOrderBy: () => queryBuilder,
    getMany: () =>
      Promise.resolve(
        rows.filter(
          (row) =>
            String(row.channelId) === queryChannelId &&
            (row.hasError || row.hasWarning)
        )
      ),
  };
  const repo = {
    createQueryBuilder: () => queryBuilder,
    upsert: (entity: Partial<ContentCheckResult>) => {
      const existing = findMatching(entity);
      if (existing) {
        Object.assign(existing, entity);
      } else {
        rows.push({ ...entity, id: nextId++ } as ContentCheckResult);
      }
      return Promise.resolve();
    },
    findOneOrFail: (options: FakeFindOneOptions) => {
      const found = findMatching(options.where);
      if (!found) {
        return Promise.reject(new Error('Not found'));
      }
      return Promise.resolve(found);
    },
  };
  const connection = {
    getRepository: () => repo,
  } as unknown as TransactionalConnection;
  return { connection, rows };
}

describe('ContentCheckResultService', () => {
  it('creates a row on the first check, and fully replaces messages on a re-check', async () => {
    const { connection, rows } = createFakeConnection();
    const service = new ContentCheckResultService(connection);
    const ctx = {} as unknown as RequestContext;

    await service.saveResult(ctx, {
      entityType: 'product',
      entityId: '1',
      channelId: '1',
      languageCode: 'en',
      messages: [
        { source: 'meta-title', severity: 'warning', code: 'X', message: 'x' },
        { source: 'json-ld', severity: 'error', code: 'Y', message: 'y' },
      ],
      checkedAt: new Date(),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].messages).toHaveLength(2);
    expect(rows[0].hasError).toBe(true);
    expect(rows[0].hasWarning).toBe(true);

    await service.saveResult(ctx, {
      entityType: 'product',
      entityId: '1',
      channelId: '1',
      languageCode: 'en',
      messages: [
        { source: 'meta-title', severity: 'warning', code: 'X', message: 'x' },
      ],
      checkedAt: new Date(),
    });

    // Same row updated in place, not a second row.
    expect(rows).toHaveLength(1);
    expect(rows[0].messages).toHaveLength(1);
    expect(rows[0].hasError).toBe(false);
    expect(rows[0].hasWarning).toBe(true);
  });

  it('omits eligibility-only warnings from global issue results', async () => {
    const { connection } = createFakeConnection();
    const service = new ContentCheckResultService(connection);
    const ctx = { channelId: '1' } as unknown as RequestContext;

    await service.saveResult(ctx, {
      entityType: 'product',
      entityId: '1',
      channelId: '1',
      languageCode: 'en',
      messages: [
        {
          source: 'meta-title',
          severity: 'warning',
          code: 'META_TITLE_MISSING',
          message: 'Page has no meta title.',
        },
      ],
      checkedAt: new Date(),
    });
    await service.saveResult(ctx, {
      entityType: 'collection',
      entityId: '2',
      channelId: '1',
      languageCode: 'en',
      messages: [
        {
          source: 'entity-eligibility',
          severity: 'warning',
          code: 'ENTITY_EXCLUDED',
          message: 'This entity is excluded from content checks.',
        },
      ],
      checkedAt: new Date(),
    });

    await expect(service.findOverview(ctx)).resolves.toMatchObject([
      { entityType: 'product', entityId: '1' },
    ]);
    await expect(
      service.findDistinctEntityTypesWithIssues(ctx)
    ).resolves.toEqual(['product']);
  });
});
