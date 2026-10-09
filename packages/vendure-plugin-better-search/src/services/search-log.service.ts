import { Inject, Injectable } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { BETTER_SEARCH_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { BetterSearchLog } from '../entities/better-search-log.entity';
import { BetterSearchOptions } from '../types';

/** Stores best-effort search events and bounds their history independently per channel. */
@Injectable()
export class SearchLogService {
  /** Injects database access and resolved plugin configuration. */
  constructor(
    private connection: TransactionalConnection,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS) private options: BetterSearchOptions
  ) {}

  /** Starts an insert without delaying searches; failures are logged once, never retried. */
  record(ctx: RequestContext, term: string, resultCount: number): void {
    if (ctx.apiType !== 'shop' || !this.options.maxLogsPerChannel) return;
    const normalized = term.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalized.length < 3 || normalized.length > 255) return;
    void this.insert(ctx, normalized, resultCount).catch((error: unknown) => {
      Logger.error(
        `Failed to store search log for channel ${ctx.channelId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        loggerCtx,
        error instanceof Error ? error.stack : undefined
      );
    });
  }

  /** Inserts directly without loading or returning the persisted entity. */
  private async insert(
    ctx: RequestContext,
    term: string,
    resultCount: number
  ): Promise<void> {
    await this.connection.getRepository(ctx, BetterSearchLog).insert({
      term,
      channelId: ctx.channelId,
      languageCode: ctx.languageCode,
      resultCount,
    });
  }

  /** Deletes logs beyond the per-channel limit in SQL using a fixed chronological cutoff. */
  async cleanup(): Promise<void> {
    const repository = this.connection.getRepository(BetterSearchLog);
    const channels = await repository
      .createQueryBuilder('log')
      .select('log.channelId', 'channelId')
      .distinct(true)
      .getRawMany<{ channelId: string | number }>();
    const limit = this.options.maxLogsPerChannel || 0;
    let totalDeleted = 0;
    for (const { channelId } of channels) {
      // For disabled storage, retain a snapshot boundary rather than chasing new rows.
      const cutoff = await repository
        .createQueryBuilder('log')
        .where('log.channelId = :channelId', { channelId })
        .orderBy('log.createdAt', 'DESC')
        .addOrderBy('log.id', 'DESC')
        .offset(limit > 0 ? limit - 1 : 0)
        .limit(1)
        .getOne();
      if (!cutoff) continue;
      const comparison = limit > 0 ? '<' : '<=';
      const result = await repository
        .createQueryBuilder()
        .delete()
        .where('channelId = :channelId', { channelId })
        .andWhere(
          `(createdAt < :createdAt OR (createdAt = :createdAt AND id ${comparison} :id))`,
          {
            createdAt: cutoff.createdAt,
            id: cutoff.id,
          }
        )
        .execute();
      const deleted = result.affected ?? 0;
      totalDeleted += deleted;
      Logger.info(
        `Search log cleanup for channel ${channelId}: deleted ${deleted} logs (retention limit: ${limit})`,
        loggerCtx
      );
    }
    Logger.info(
      `Search log cleanup completed: deleted ${totalDeleted} logs across ${channels.length} channels`,
      loggerCtx
    );
  }
}
